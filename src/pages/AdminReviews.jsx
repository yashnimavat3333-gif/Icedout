import React, { useEffect, useState, useCallback } from "react";
import { Query } from "appwrite";
import conf from "../conf/conf";
import { databases, bucket, account } from "../conf/index";
import SpinnerLoader from "../components/SpinnerLoader";

/**
 * AdminReviewPanel with Edit capability
 *
 * - Edit opens a modal-like panel
 * - Admin can edit: name, rating, comment, status, verified, add/remove images
 */

export default function AdminReviewPanel({ productId = null }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [showAllMode, setShowAllMode] = useState(false);
  const MAX_FETCH_ALL = 2000;

  // Edit modal state
  const [editing, setEditing] = useState(null); // review object being edited
  const [editForm, setEditForm] = useState({
    name: "",
    rating: 5,
    comment: "",
    status: "approved",
    verified: false,
    existingImages: [],
    newImages: [],
    removeImageIds: new Set(),
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const isAdmin = (u) =>
    Array.isArray(conf.adminUserIds) && u && conf.adminUserIds.includes(u.$id);

  // load current user
  const fetchUser = useCallback(async () => {
    try {
      const u = await account.get();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const buildQueries = (pageNum = 1, limit = PAGE_SIZE) => {
    const queries = [];
    if (productId) queries.push(Query.equal("productId", productId));
    if (filter && filter !== "all") queries.push(Query.equal("status", filter));
    queries.push(Query.orderDesc("$createdAt"));
    queries.push(Query.limit(limit));
    queries.push(Query.offset((pageNum - 1) * limit));
    return queries;
  };

  const fetchPage = useCallback(
    async (pageNum = 1, limit = PAGE_SIZE) => {
      setLoading(true);
      setError(null);
      try {
        const res = await databases.listDocuments(
          conf.appwriteDatabaseId,
          conf.appwriteReviewsCollectionId,
          buildQueries(pageNum, limit)
        );
        return res.documents || [];
      } catch (err) {
        console.error("fetchPage", err);
        setError("Failed to load reviews");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [filter, q, productId]
  );

  const fetchReviews = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      setError(null);
      try {
        const docs = await fetchPage(pageNum, PAGE_SIZE);
        const filtered = q.trim()
          ? docs.filter(
              (d) =>
                (d.name || "").toLowerCase().includes(q.toLowerCase()) ||
                (d.comment || "").toLowerCase().includes(q.toLowerCase())
            )
          : docs;
        setReviews(filtered);
      } catch (err) {
        console.error("fetchReviews", err);
        setError("Failed to load reviews");
      } finally {
        setLoading(false);
      }
    },
    [fetchPage, q]
  );

  const fetchAllReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    const agg = [];
    try {
      let p = 1;
      while (agg.length < MAX_FETCH_ALL) {
        const docs = await fetchPage(p, PAGE_SIZE);
        if (!docs.length) break;
        agg.push(...docs);
        if (docs.length < PAGE_SIZE) break;
        p += 1;
      }
      const filtered = q.trim()
        ? agg.filter(
            (d) =>
              (d.name || "").toLowerCase().includes(q.toLowerCase()) ||
              (d.comment || "").toLowerCase().includes(q.toLowerCase())
          )
        : agg;
      setReviews(filtered);
    } catch (err) {
      console.error("fetchAllReviews", err);
      setError("Failed to load all reviews");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, q]);

  useEffect(() => {
    if (!isAdmin(user)) {
      setLoading(false);
      return;
    }
    if (showAllMode) fetchAllReviews();
    else fetchReviews(1);
    setPage(1);
  }, [user, filter, q, productId, showAllMode, fetchReviews, fetchAllReviews]);

  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllOnPage = () => setSelected(new Set(reviews.map((r) => r.$id)));
  const clearSelection = () => setSelected(new Set());

  const updateStatus = async (id, status) => {
    if (
      !window.confirm(
        `Are you sure you want to mark this review as '${status}'?`
      )
    )
      return null;
    try {
      const updated = await databases.updateDocument(
        conf.appwriteDatabaseId,
        conf.appwriteReviewsCollectionId,
        id,
        { status }
      );
      setReviews((prev) => prev.filter((r) => r.$id !== id));
      setSelected((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      return updated;
    } catch (err) {
      console.error("updateStatus", err);
      alert("Failed to update status");
      return null;
    }
  };

  const deleteReview = async (id) => {
    if (!window.confirm("Delete this review permanently?")) return;
    try {
      await databases.deleteDocument(
        conf.appwriteDatabaseId,
        conf.appwriteReviewsCollectionId,
        id
      );
      setReviews((prev) => prev.filter((r) => r.$id !== id));
      setSelected((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error("deleteReview", err);
      alert("Failed to delete review");
    }
  };

  const bulkUpdate = async (status) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    if (
      !window.confirm(`Change status to '${status}' for ${ids.length} reviews?`)
    )
      return;
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await updateStatus(id, status);
    }
    if (showAllMode) fetchAllReviews();
    else fetchReviews(page);
    clearSelection();
  };

  const viewImageSrc = (fileId) => {
    if (!fileId) return "";
    if (typeof bucket.getFilePreview === "function")
      return bucket.getFilePreview(conf.appwriteReviewBucketId, fileId);
    return `/api/bucket/preview/${conf.appwriteReviewBucketId}/${fileId}`;
  };

  // ------------------ EDIT FLOW ------------------
  const openEdit = (review) => {
    setEditing(review);
    setEditForm({
      name: review.name || "",
      rating: review.rating || 5,
      comment: review.comment || "",
      status: review.status || "approved",
      verified: !!review.verified,
      existingImages: Array.isArray(review.images) ? [...review.images] : [],
      newImages: [],
      removeImageIds: new Set(),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm({
      name: "",
      rating: 5,
      comment: "",
      status: "approved",
      verified: false,
      existingImages: [],
      newImages: [],
      removeImageIds: new Set(),
    });
  };

  const handleRemoveExistingImage = (fileId) => {
    setEditForm((s) => {
      const nextRem = new Set(s.removeImageIds);
      nextRem.add(fileId);
      return {
        ...s,
        removeImageIds: nextRem,
        existingImages: s.existingImages.filter((f) => f !== fileId),
      };
    });
  };

  const handleAddNewFiles = (files) => {
    setEditForm((s) => ({
      ...s,
      newImages: [...s.newImages, ...Array.from(files)],
    }));
  };

  const handleRemoveNewFile = (index) => {
    setEditForm((s) => {
      const arr = [...s.newImages];
      arr.splice(index, 1);
      return { ...s, newImages: arr };
    });
  };

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return [];
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const created = await bucket.createFile(
          conf.appwriteReviewBucketId,
          "unique()",
          files[i]
        );
        uploaded.push(created.$id || created.id || created);
      } catch (err) {
        console.error("uploadFiles", err);
      }
    }
    return uploaded;
  };

  const submitEdit = async () => {
    if (!editing) return;
    setEditSubmitting(true);
    try {
      // upload new images if any
      const uploadedIds = await uploadFiles(editForm.newImages);

      // compute final images array: existingImages (minus removed) + uploadedIds
      const finalImages = [...(editForm.existingImages || []), ...uploadedIds];

      const payload = {
        name: editForm.name.trim(),
        rating: Number(editForm.rating),
        comment: editForm.comment.trim(),
        images: finalImages,
        verified: !!editForm.verified,
        status: editForm.status,
        // you may also update an updatedAt field if you want
        updatedAt: new Date().toISOString(),
      };

      const updated = await databases.updateDocument(
        conf.appwriteDatabaseId,
        conf.appwriteReviewsCollectionId,
        editing.$id,
        payload
      );

      // update UI in place
      setReviews((prev) =>
        prev.map((r) => (r.$id === updated.$id ? updated : r))
      );

      // remove from moderation queue if present
      setEditSubmitting(false);
      closeEdit();
      alert("Review updated.");
    } catch (err) {
      console.error("submitEdit", err);
      alert("Failed to update review.");
      setEditSubmitting(false);
    }
  };

  // ------------------ END EDIT FLOW ------------------

  if (loading) return <SpinnerLoader />;

  if (!isAdmin(user)) {
    return (
      <div className="p-6 bg-white rounded shadow">
        <h3 className="text-lg font-medium">Admin Review Panel</h3>
        <p className="text-sm text-gray-500 mt-2">
          Access denied. You must be an admin to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded shadow">
      {/* Edit modal/top area */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div className="bg-white w-full max-w-3xl rounded shadow-lg p-6 border">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Edit Review</h4>
              <div className="flex gap-2">
                <button
                  onClick={closeEdit}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEdit}
                  disabled={editSubmitting}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  {editSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="Name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, name: e.target.value }))
                }
              />
              <select
                className="w-full border p-2 rounded"
                value={editForm.rating}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, rating: e.target.value }))
                }
              >
                {[5, 4, 3, 2, 1].map((i) => (
                  <option key={i} value={i}>
                    {i} Star{i > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <textarea
                className="w-full border p-2 rounded"
                rows={4}
                value={editForm.comment}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, comment: e.target.value }))
                }
              />

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!editForm.verified}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, verified: e.target.checked }))
                    }
                  />
                  <span className="text-sm">Verified purchase</span>
                </label>

                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, status: e.target.value }))
                  }
                  className="border p-2 rounded"
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* existing images preview with remove */}
              <div>
                <div className="text-sm font-medium mb-2">Existing Images</div>
                <div className="flex gap-2 overflow-x-auto">
                  {editForm.existingImages &&
                    editForm.existingImages.length === 0 && (
                      <div className="text-sm text-gray-500">No images</div>
                    )}
                  {editForm.existingImages.map((fid) => (
                    <div key={fid} className="relative">
                      <img
                        src={viewImageSrc(fid)}
                        alt="img"
                        className="w-24 h-24 object-cover rounded"
                      />
                      <button
                        onClick={() => handleRemoveExistingImage(fid)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* new images to add */}
              <div>
                <div className="text-sm font-medium mb-2">Add Images</div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleAddNewFiles(e.target.files)}
                />
                <div className="flex gap-2 mt-2">
                  {editForm.newImages.map((f, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={URL.createObjectURL(f)}
                        alt="new"
                        className="w-24 h-24 object-cover rounded"
                      />
                      <button
                        onClick={() => handleRemoveNewFile(idx)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* top controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Reviews — Admin</h3>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <input
            placeholder="Search name or comment"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border p-2 rounded"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAllMode}
              onChange={(e) => setShowAllMode(e.target.checked)}
            />
            <span className="text-sm text-gray-600">Show all</span>
          </label>

          <button
            onClick={() => {
              if (showAllMode) fetchAllReviews();
              else fetchReviews(page);
            }}
            className="px-3 py-2 bg-gray-800 text-white rounded"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              setShowAllMode((s) => !s);
              if (!showAllMode) fetchAllReviews();
              else fetchReviews(page);
            }}
            className="px-3 py-2 border rounded"
          >
            {showAllMode ? "Switch to paged" : "Fetch all now"}
          </button>
        </div>
      </div>

      {/* bulk controls */}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={selectAllOnPage} className="px-3 py-1 border rounded">
          Select all on page
        </button>
        <button onClick={clearSelection} className="px-3 py-1 border rounded">
          Clear
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => bulkUpdate("approved")}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            Approve selected
          </button>
          <button
            onClick={() => bulkUpdate("rejected")}
            className="px-3 py-1 bg-red-600 text-white rounded"
          >
            Reject selected
          </button>
          <button
            onClick={() => {
              if (!window.confirm("Delete selected reviews?")) return;
              Array.from(selected).forEach((id) =>
                databases.deleteDocument(
                  conf.appwriteDatabaseId,
                  conf.appwriteReviewsCollectionId,
                  id
                )
              );
              setReviews((r) => r.filter((x) => !selected.has(x.$id)));
              clearSelection();
            }}
            className="px-3 py-1 border rounded"
          >
            Delete selected
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* reviews list */}
      <div className="space-y-4">
        {reviews.length === 0 && (
          <p className="text-sm text-gray-500">No reviews found.</p>
        )}

        {reviews.map((r) => (
          <div
            key={r.$id}
            className="border rounded p-4 flex gap-4 items-start"
          >
            <input
              type="checkbox"
              checked={selected.has(r.$id)}
              onChange={() => toggleSelect(r.$id)}
            />

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <strong>{r.name}</strong>
                    <span className="text-xs text-gray-500">
                      {r.userId ? `user:${r.userId}` : "anonymous"}
                    </span>
                    {r.verified && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 rounded">
                        Verified
                      </span>
                    )}
                    <span className="ml-2 text-xs bg-gray-100 text-gray-700 px-2 rounded">
                      {r.status || "unknown"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <svg
                        key={i}
                        className={`w-4 h-4 ${
                          i <= r.rating ? "text-yellow-400" : "text-gray-300"
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  {new Date(
                    r.$createdAt || r.createdAt || r._createdAt
                  ).toLocaleString()}
                </div>
              </div>

              <p className="mt-3 text-gray-700">{r.comment}</p>

              {Array.isArray(r.images) && r.images.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {r.images.map((fid) => (
                    <img
                      key={fid}
                      src={viewImageSrc(fid)}
                      alt="rev"
                      className="w-20 h-20 object-cover rounded"
                    />
                  ))}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => updateStatus(r.$id, "approved")}
                  className="px-3 py-1 bg-green-600 text-white rounded"
                >
                  Approve
                </button>
                <button
                  onClick={() => updateStatus(r.$id, "rejected")}
                  className="px-3 py-1 bg-red-600 text-white rounded"
                >
                  Reject
                </button>
                <button
                  onClick={() => deleteReview(r.$id)}
                  className="px-3 py-1 border rounded"
                >
                  Delete
                </button>
                <button
                  onClick={() => openEdit(r)}
                  className="px-3 py-1 border rounded"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showAllMode && (
        <div className="mt-6 flex items-center justify-between">
          <div>
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                fetchReviews(page - 1);
              }}
              className="px-3 py-1 border rounded mr-2"
            >
              Prev
            </button>
            <button
              onClick={() => {
                setPage((p) => p + 1);
                fetchReviews(page + 1);
              }}
              className="px-3 py-1 border rounded"
            >
              Next
            </button>
          </div>
          <div className="text-sm text-gray-500">Page {page}</div>
        </div>
      )}
    </div>
  );
}
