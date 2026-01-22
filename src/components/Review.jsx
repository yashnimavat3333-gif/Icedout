import React, { useEffect, useMemo, useRef, useState } from "react";
import { Query } from "appwrite";
import conf from "../conf/conf";
import { databases, bucket, account } from "../conf/index";
import SpinnerLoader from "./SpinnerLoader";

/**
 * Review component (full-featured)
 *
 * Props:
 *   - productId: string
 *
 * Expected conf keys:
 *   - conf.appwriteDatabaseId
 *   - conf.appwriteReviewsCollectionId
 *   - conf.appwriteOrdersCollectionId (used for verified purchases)
 *   - conf.appwriteReviewBucketId (storage bucket id for images)
 *   - conf.adminUserIds (array of admin ids for moderation)
 *
 * Notes:
 *   - Ensure ../../conf/index exports `databases`, `storage`, and `account` from Appwrite SDK.
 */

export default function Review({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    rating: "",
    comment: "",
    images: [],
  });
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const observerRef = useRef(null);

  const PAGE_SIZE = 10;

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      try {
        const u = await account.get();
        if (mounted) setCurrentUser(u);
      } catch {
        if (mounted) setCurrentUser(null);
      }
    };

    fetchUser();
    return () => {
      mounted = false;
    };
  }, []);

  // initial load
  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setPage(1);

    const load = async () => {
      try {
        const res = await databases.listDocuments(
          conf.appwriteDatabaseId,
          conf.appwriteReviewsCollectionId,
          [
            Query.equal("productId", productId),
            Query.equal("status", "approved"),
            Query.orderDesc("$createdAt"),
            Query.limit(PAGE_SIZE),
          ]
        );

        const docs = res.documents || [];
        setReviews(docs);
        setHasMore(docs.length === PAGE_SIZE);
      } catch (err) {
        console.error("load reviews", err);
        setError("Failed to load reviews");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [productId]);

  // moderation queue for admins
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await databases.listDocuments(
          conf.appwriteDatabaseId,
          conf.appwriteReviewsCollectionId,
          [Query.equal("status", "pending"), Query.orderDesc("$createdAt")]
        );
        setModerationQueue(res.documents || []);
      } catch (err) {
        console.error("fetchQueue", err);
      }
    };

    if (
      currentUser &&
      Array.isArray(conf.adminUserIds) &&
      conf.adminUserIds.includes(currentUser.$id)
    ) {
      fetchQueue();
    }
  }, [currentUser]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((a, r) => a + Number(r.rating || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  // client-side simple rate-limit: 60s per product per browser
  const canSubmit = () => {
    try {
      const key = `lastReview:${productId}`;
      const last = localStorage.getItem(key);
      if (!last) return true;
      const ts = Number(last);
      if (Number.isNaN(ts)) return true;
      return Date.now() - ts > 60_000;
    } catch {
      return true;
    }
  };
  const markSubmitted = () => {
    try {
      localStorage.setItem(`lastReview:${productId}`, String(Date.now()));
    } catch {}
  };

  // check if user purchased product (best-effort)
  const checkVerifiedPurchase = async (userId) => {
    if (!userId || !conf.appwriteOrdersCollectionId) return false;
    try {
      const res = await databases.listDocuments(
        conf.appwriteDatabaseId,
        conf.appwriteOrdersCollectionId,
        [
          Query.equal("productId", productId),
          Query.equal("userId", userId),
          Query.limit(1),
        ]
      );
      return (res.documents || []).length > 0;
    } catch (err) {
      console.error("checkVerifiedPurchase", err);
      return false;
    }
  };

  // upload files to Appwrite storage; returns array of fileIds
  const uploadImages = async (files) => {
    if (!files || files.length === 0 || !conf.appwriteReviewBucketId) return [];
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const created = await bucket.createFile(
          conf.appwriteReviewBucketId,
          "unique()",
          f
        );
        uploaded.push(created.$id || created.id || created);
      } catch (err) {
        console.error("uploadImages", err);
      }
    }
    return uploaded;
  };

  const submitReview = async () => {
    if (!form.name.trim() || !form.rating || !form.comment.trim()) {
      alert("Please fill all fields.");
      return;
    }
    if (!canSubmit()) {
      alert("Please wait a moment before submitting another review.");
      return;
    }

    setSubmitting(true);
    try {
      const files = form.images || [];
      const uploadedFileIds = await uploadImages(files);

      let verified = false;
      try {
        const userId = currentUser?.$id || null;
        if (userId) verified = await checkVerifiedPurchase(userId);
      } catch {}

      const payload = {
        productId,
        name: form.name.trim(),
        rating: Number(form.rating),
        comment: form.comment.trim(),
        images: uploadedFileIds,
        verified,
        status:
          Array.isArray(conf.adminUserIds) && conf.adminUserIds.length
            ? "pending"
            : "approved",
        $createdAt: new Date().toISOString(),
        userId: currentUser?.$id || null,
      };

      const created = await databases.createDocument(
        conf.appwriteDatabaseId,
        conf.appwriteReviewsCollectionId,
        "unique()",
        payload
      );

      if (payload.status === "approved") {
        setReviews((p) => [created, ...p]);
      } else {
        setModerationQueue((q) => [created, ...q]);
      }

      markSubmitted();
      setForm({ name: "", rating: "", comment: "", images: [] });
      alert(
        "Thanks — your review has been submitted." +
          (payload.status === "pending"
            ? " It will appear after moderation."
            : "")
      );
    } catch (err) {
      console.error("submitReview", err);
      alert("Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  // admin: approve/reject
  const updateReviewStatus = async (reviewId, newStatus) => {
    try {
      const updated = await databases.updateDocument(
        conf.appwriteDatabaseId,
        conf.appwriteReviewsCollectionId,
        reviewId,
        { status: newStatus }
      );

      setModerationQueue((q) => q.filter((r) => r.$id !== reviewId));

      if (newStatus === "approved") {
        setReviews((p) => [updated, ...p]);
      }
    } catch (err) {
      console.error("updateReviewStatus", err);
      alert("Failed to update review status.");
    }
  };

  // pagination / infinite scroll
  const loadMore = async (nextPage = page + 1) => {
    try {
      const res = await databases.listDocuments(
        conf.appwriteDatabaseId,
        conf.appwriteReviewsCollectionId,
        [
          Query.equal("productId", productId),
          Query.equal("status", "approved"),
          Query.orderDesc("$createdAt"),
          Query.limit(PAGE_SIZE),
          Query.offset((nextPage - 1) * PAGE_SIZE),
        ]
      );
      const docs = res.documents || [];
      setReviews((p) => [...p, ...docs]);
      setPage(nextPage);
      setHasMore(docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("loadMore", err);
    }
  };

  useEffect(() => {
    if (!hasMore) return;
    const el = observerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) loadMore();
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observerRef.current, hasMore, page]);

  if (loading) return <SpinnerLoader />;

  return (
    <section className="mt-16">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Customer Reviews & Ratings
      </h2>

      {/* Summary */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl font-bold">{avgRating.toFixed(1)}</span>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((i) => (
            <svg
              key={i}
              className={`w-5 h-5 ${
                i <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-300"
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className="text-sm text-gray-500">
          ({reviews.length} reviews)
        </span>
      </div>

      {/* Reviews list */}
      <div className="space-y-6 mb-10">
        {reviews.length === 0 && (
          <p className="text-gray-500">No reviews yet. Be the first!</p>
        )}

        {reviews.map((r) => (
          <div
            key={r.$id || r.$uid || r.id}
            className="border border-gray-200 p-4 rounded-md shadow-sm"
          >
            <div className="flex justify-between mb-1">
              <div className="flex items-center gap-3">
                <p className="font-medium">{r.name}</p>
                {r.verified && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Verified Purchase
                  </span>
                )}
              </div>

              <div className="flex">
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

            <p className="text-gray-700">{r.comment}</p>

            {Array.isArray(r.images) && r.images.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {r.images.map((fid) => {
                  // try SDK preview helper if present, otherwise fallback URL pattern
                  const src =
                    typeof bucket.getFilePreview === "function"
                      ? bucket.getFilePreview(conf.appwriteReviewBucketId, fid)
                      : `/api/bucket/preview/${conf.appwriteReviewBucketId}/${fid}`;
                  return (
                    <img
                      key={fid}
                      src={src}
                      alt="Customer review image"
                      width="96"
                      height="96"
                      className="w-24 h-24 object-cover rounded"
                      loading="lazy"
                      decoding="async"
                    />
                  );
                })}
              </div>
            )}

            <p className="text-xs text-gray-400 mt-1">
              {new Date(r.$createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}

        {/* sentinel for infinite scroll */}
        {hasMore && <div ref={observerRef} className="h-8" />}
      </div>

      {/* Add Review Form */}
      <h3 className="text-lg font-medium mb-4">Write a Review</h3>

      <div className="space-y-3 max-w-xl">
        <input
          type="text"
          placeholder="Your Name"
          className="w-full border p-3 rounded-md"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
        />

        <select
          className="w-full border p-3 rounded-md"
          value={form.rating}
          onChange={(e) => setForm((s) => ({ ...s, rating: e.target.value }))}
        >
          <option value="">Rating</option>
          {[1, 2, 3, 4, 5].map((i) => (
            <option key={i} value={i}>
              {i} Star{i > 1 ? "s" : ""}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Your Review"
          className="w-full border p-3 rounded-md"
          rows="4"
          value={form.comment}
          onChange={(e) => setForm((s) => ({ ...s, comment: e.target.value }))}
        />

        <label className="flex flex-col gap-2 text-sm">
          Add photos (optional)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) =>
              setForm((s) => ({ ...s, images: Array.from(e.target.files) }))
            }
          />
        </label>

        <div className="flex gap-2">
          <button
            onClick={submitReview}
            disabled={submitting}
            className="px-6 py-3 bg-gray-900 text-white rounded-md w-full hover:bg-gray-800"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Moderation panel for admins */}
      {currentUser &&
        Array.isArray(conf.adminUserIds) &&
        conf.adminUserIds.includes(currentUser.$id) && (
          <section className="mt-12">
            <h3 className="text-lg font-medium mb-4">Moderation Queue</h3>
            {moderationQueue.length === 0 && (
              <p className="text-gray-500">No pending reviews.</p>
            )}

            {moderationQueue.map((r) => (
              <div
                key={r.$id}
                className="border border-yellow-200 p-4 rounded-md mb-4 bg-yellow-50"
              >
                <div className="flex justify-between mb-2">
                  <div>
                    <p className="font-medium">
                      {r.name}{" "}
                      {r.verified && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                          Verified
                        </span>
                      )}
                    </p>
                    <div className="flex mt-1">
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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateReviewStatus(r.$id, "approved")}
                      className="px-3 py-1 bg-green-600 text-white rounded"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateReviewStatus(r.$id, "rejected")}
                      className="px-3 py-1 bg-red-600 text-white rounded"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <p className="text-gray-700 mb-2">{r.comment}</p>

                {Array.isArray(r.images) && r.images.length > 0 && (
                  <div className="flex gap-2">
                    {r.images.map((fid) => {
                      const src =
                        typeof bucketbucket.getFilePreview === "function"
                          ? bucket.getFilePreview(
                              conf.appwriteReviewBucketId,
                              fid
                            )
                          : `/api/bucket/preview/${conf.appwriteReviewBucketId}/${fid}`;
                      return (
                        <img
                          key={fid}
                          src={src}
                          alt="rev"
                          className="w-20 h-20 object-cover rounded"
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
    </section>
  );
}
