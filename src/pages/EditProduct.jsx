import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Client, Storage, ID } from "appwrite";
import { databases } from "../conf/index"; // your Appwrite setup (databases instance)
import conf from "../conf/conf";
import RTE from "../components/RTE"; // same RTE used in ProductForm

// If you already export a configured client elsewhere, import that instead of creating here
const client = new Client()
  .setEndpoint(conf.appwriteUrl)
  .setProject(conf.appwriteProjectId);
const storage = new Storage(client);

const emptyVariation = {
  name: "",
  price: "",
  stock: "",
  sku: "",
  discount: "",
};

const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    title: "",
    description: "",
    price: "",
    stock: "",
    categories: "",
    brand: "",
    model: "",
    tags: "",
    is_featured: false,
    discount: "0.0",
    images: [], // existing fileIds
    size: "",
    type: "",
    warranty: "",
    shipping: "",
    useVariations: true,
    variations: [
      { name: "Normal", price: "", stock: "", sku: "", discount: "" },
      { name: "Upgraded", price: "", stock: "", sku: "", discount: "" },
    ],
  });

  // New uploads (File objects) + previews
  const [newFiles, setNewFiles] = useState([]); // Array<File>
  const [newPreviews, setNewPreviews] = useState([]); // URLs

  // Derived counts for description
  const descriptionStats = useMemo(() => {
    const plain = form.description
      ? String(form.description)
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    return { words: plain ? plain.split(" ").length : 0, chars: plain.length };
  }, [form.description]);

  const fetchProduct = async () => {
    try {
      const product = await databases.getDocument(
        conf.appwriteDatabaseId,
        conf.appwriteProductCollectionId,
        id
      );

      setForm({
        name: product.name || "",
        title: product.title || "",
        description: product.description || "",
        price: product.price ?? "",
        stock: product.stock ?? "",
        categories: product.categories || "",
        brand: product.brand || "",
        model: product.model || "",
        tags: Array.isArray(product.tags)
          ? product.tags.join(", ")
          : product.tags || "",
        is_featured: !!product.is_featured,
        discount: product.discount?.toString?.() ?? "0.0",
        images: Array.isArray(product.images) ? product.images : [],
        size: Array.isArray(product.size)
          ? product.size.join(", ")
          : product.size || "",
        type: product.type || "",
        warranty: product.warranty || "",
        shipping: product.shipping || "",
        useVariations: !!product.useVariations,
        variations: product.useVariations
          ? (product.variations || []).map((v) => {
              // Stored as JSON strings in ProductForm
              const parsed = typeof v === "string" ? JSON.parse(v) : v;
              return {
                name: parsed?.name || "",
                price: parsed?.price?.toString?.() || "",
                stock: parsed?.stock?.toString?.() || "",
                sku: parsed?.sku || "",
                discount: parsed?.discount?.toString?.() || "",
              };
            })
          : [emptyVariation],
      });
    } catch (err) {
      console.error("Failed to fetch product:", err);
      setError("Failed to fetch product");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
    // cleanup object URLs on unmount
    return () => newPreviews.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      const isVideo = f.type.startsWith("video/");
      const max = isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
      return f.size <= max;
    });
    const urls = valid.map((f) => URL.createObjectURL(f));

    setNewFiles((prev) => [...prev, ...valid]);
    setNewPreviews((prev) => [...prev, ...urls]);
  };

  const removeNewFile = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    const url = newPreviews[idx];
    URL.revokeObjectURL(url);
    setNewPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const existingImageUrl = (fileId) => {
    if (!fileId) return null;
    try {
      return storage.getFileView(conf.appwriteBucketId, fileId);
    } catch {
      return storage.getFileView(conf.appwriteBucketId, fileId);
    }
  };

  const deleteExistingImage = async (fileId) => {
    try {
      // 1) Remove from bucket (optional – if you truly want to delete the file)
      await storage.deleteFile(conf.appwriteBucketId, fileId);
      // 2) Remove from product document
      const next = (form.images || []).filter((id) => id !== fileId);
      setForm((prev) => ({ ...prev, images: next }));
    } catch (err) {
      console.error("Delete image failed:", err);
      setError("Failed to delete image");
    }
  };

  const addVariation = () =>
    setForm((p) => ({
      ...p,
      variations: [...p.variations, { ...emptyVariation }],
    }));
  const removeVariation = (index) =>
    setForm((p) => ({
      ...p,
      variations: p.variations.filter((_, i) => i !== index),
    }));
  const updateVariation = (index, field, value) =>
    setForm((p) => {
      const copy = [...p.variations];
      copy[index] = { ...copy[index], [field]: value };
      return { ...p, variations: copy };
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // 1) Upload any new files
      const uploadedIds = [];
      for (const f of newFiles) {
        const res = await storage.createFile(
          conf.appwriteBucketId,
          ID.unique(),
          f
        );
        uploadedIds.push(res.$id);
      }

      // 2) Merge with existing
      const images = [...(form.images || []), ...uploadedIds];

      // 3) Build update payload
      const payload = {
        name: form.name,
        title: form.title,
        description: form.description || "",
        categories: form.categories,
        brand: form.brand,
        model: form.model,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        is_featured: !!form.is_featured,
        discount: parseFloat(form.discount || 0),
        images,
        size: form.size
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        type: form.type,
        warranty: form.warranty,
        shipping: form.shipping,
        useVariations: !!form.useVariations,
      };

      if (form.useVariations) {
        payload.price = null;
        payload.stock = null;
        payload.variations = form.variations.map((v) =>
          JSON.stringify({
            name: v.name.trim(),
            price: parseFloat(v.price || 0),
            stock: parseInt(v.stock || 0, 10),
            sku: v.sku?.trim() || null,
            discount: v.discount !== "" ? parseFloat(v.discount) : null,
          })
        );
      } else {
        payload.price = parseFloat(form.price || 0);
        payload.stock = parseInt(form.stock || 0, 10);
        payload.variations = [];
      }

      await databases.updateDocument(
        conf.appwriteDatabaseId,
        conf.appwriteProductCollectionId,
        id,
        payload
      );

      navigate("/admin");
    } catch (err) {
      console.error("Update failed:", err);
      setError("Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Edit Product</h2>

      {error && (
        <div className="mb-4 rounded bg-red-50 text-red-700 p-3 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Basic fields */}
        {[
          ["name", "Product Name*"],
          ["title", "Title"],
          ["brand", "Brand"],
          ["model", "Model"],
          ["tags", "Tags (comma)"],
          ["discount", "Discount (%)"],
          ["size", "Size (comma)"],
          ["type", "Type"],
          ["categories", "Category"],
        ].map(([name, label]) => (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-sm text-gray-600" htmlFor={name}>
              {label}
            </label>
            <input
              id={name}
              name={name}
              type="text"
              value={form[name]}
              onChange={onField}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        ))}

        {/* Price/Stock only if not using variations */}
        {!form.useVariations && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600" htmlFor="price">
                Price
              </label>
              <input
                id="price"
                name="price"
                type="number"
                value={form.price}
                onChange={onField}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600" htmlFor="stock">
                Stock
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                value={form.stock}
                onChange={onField}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </>
        )}

        {/* Description */}
        <div className="md:col-span-2">
          <label className="text-sm text-gray-600">Description</label>
          <RTE
            label={false}
            value={form.description}
            onChange={(content) =>
              setForm((p) => ({ ...p, description: content }))
            }
          />
          <div className="text-xs text-gray-500 mt-1">
            {descriptionStats.words} words • {descriptionStats.chars} characters
          </div>
        </div>

        {/* Featured toggle */}
        <div className="flex items-center gap-2">
          <input
            id="is_featured"
            name="is_featured"
            type="checkbox"
            checked={!!form.is_featured}
            onChange={onField}
          />
          <label htmlFor="is_featured">Featured Product</label>
        </div>

        {/* Shipping (RTE) */}
        <div className="md:col-span-2">
          <label className="text-sm text-gray-600">Shipping</label>
          <RTE
            label={false}
            value={form.shipping}
            onChange={(content) =>
              setForm((p) => ({ ...p, shipping: content }))
            }
          />
        </div>

        {/* Warranty (RTE) */}
        <div className="md:col-span-2">
          <label className="text-sm text-gray-600">Warranty</label>
          <RTE
            label={false}
            value={form.warranty}
            onChange={(content) =>
              setForm((p) => ({ ...p, warranty: content }))
            }
          />
        </div>

        {/* Existing Images */}
        <div className="md:col-span-2">
          <h3 className="font-semibold mb-2">Existing Images</h3>
          {(!form.images || form.images.length === 0) && (
            <div className="text-sm text-gray-500">No images yet.</div>
          )}
          <div className="flex flex-wrap gap-3">
            {(form.images || []).map((fid) => (
              <div key={fid} className="relative border rounded p-2">
                <img
                  src={existingImageUrl(fid)}
                  alt={fid}
                  className="w-40 h-40 object-cover rounded"
                />
                {/* {console.log(existingImageUrl(fid))} */}
                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-red-600 text-white w-7 h-7 rounded-full"
                  title="Delete image"
                  onClick={() => deleteExistingImage(fid)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add new images */}
        <div className="md:col-span-2">
          <label className="text-sm text-gray-600">Add Images/Videos</label>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={onFiles}
          />
          <div className="text-xs text-gray-500 mt-1">
            Images up to 5MB, videos up to 100MB.
          </div>
          {newPreviews.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {newPreviews.map((url, i) => (
                <div key={url} className="relative border rounded p-2">
                  {/* We can't always know type here; show as <img> and let it fail gracefully */}
                  <img
                    src={url}
                    alt={`new-${i}`}
                    className="w-40 h-40 object-cover rounded"
                  />

                  <button
                    type="button"
                    className="absolute -top-2 -right-2 bg-gray-800 text-white w-7 h-7 rounded-full"
                    title="Remove"
                    onClick={() => removeNewFile(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variations toggle */}
        <div className="md:col-span-2 flex items-center gap-2">
          <input
            id="useVariations"
            name="useVariations"
            type="checkbox"
            checked={!!form.useVariations}
            onChange={onField}
          />
          <label htmlFor="useVariations">Use variations</label>
        </div>

        {/* Variations list */}
        {form.useVariations && (
          <div className="md:col-span-2 grid gap-3">
            {form.variations.map((v, idx) => (
              <div
                key={idx}
                className="grid md:grid-cols-6 gap-2 border rounded p-3"
              >
                <div className="col-span-1">
                  <label className="text-xs text-gray-600">Name</label>
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) =>
                      updateVariation(idx, "name", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-gray-600">Price</label>
                  <input
                    type="number"
                    value={v.price}
                    onChange={(e) =>
                      updateVariation(idx, "price", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-gray-600">Stock</label>
                  <input
                    type="number"
                    value={v.stock}
                    onChange={(e) =>
                      updateVariation(idx, "stock", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-gray-600">SKU</label>
                  <input
                    type="text"
                    value={v.sku}
                    onChange={(e) =>
                      updateVariation(idx, "sku", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-gray-600">Discount (%)</label>
                  <input
                    type="number"
                    value={v.discount}
                    onChange={(e) =>
                      updateVariation(idx, "discount", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => removeVariation(idx)}
                    className="px-3 py-2 border rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addVariation}
              className="px-3 py-2 border rounded w-fit"
            >
              + Add Variation
            </button>
          </div>
        )}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-teal-700 text-white rounded-lg"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProduct;
