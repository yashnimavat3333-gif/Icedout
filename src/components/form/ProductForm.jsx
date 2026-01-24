// src/components/ProductForm.jsx
import { useEffect, useMemo, useState } from "react";
import productService from "../../appwrite/config";
import RTE from "../RTE"; // adjust path if needed

const ProductForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    price: "",
    stock: "",
    categories: "",
    description: "",
    brand: "",
    model: "",
    tags: "",
    is_featured: false,
    discount: "0.0",
    images: [], // Array<File> in chosen order
    size: "",
    type: "",
    warranty: "", // now HTML string from RTE
    shipping: "", // now HTML string from RTE
    useVariations: true,
    variations: [
      { name: "Normal", price: "", stock: "", sku: "", discount: "" },
      { name: "Upgraded", price: "", stock: "", sku: "", discount: "" },
    ],
  });

  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // [{id,file,url,type}] — order is exactly what the user arranges
  const [previewFiles, setPreviewFiles] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    setCategories([
      { $id: "luxury_watch", name: "Luxury Watch" },
      { $id: "ring", name: "Ring" },
      { $id: "bracelet", name: "Bracelet" },
      { $id: "plain_watch", name: "Plain Watch" },
      { $id: "chains", name: "Chains" },
    ]);
    // cleanup on unmount
    return () => {
      previewFiles.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Helpers for uploads / previews / reorder ----
  const uploadMedia = async (file) => {
    const isVideo = file.type.startsWith("video/");
    if (isVideo) {
      if (typeof productService.uploadVideo === "function")
        return productService.uploadVideo(file);
      if (typeof productService.uploadFile === "function")
        return productService.uploadFile(file);
      if (typeof productService.uploadImage === "function")
        return productService.uploadImage(file);
      throw new Error("No suitable upload method for videos found.");
    } else {
      if (typeof productService.uploadImage === "function")
        return productService.uploadImage(file);
      if (typeof productService.uploadFile === "function")
        return productService.uploadFile(file);
      throw new Error("No suitable upload method for images found.");
    }
  };

  const buildPreview = (file) => ({
    id:
      file.name +
      "-" +
      file.size +
      "-" +
      file.lastModified +
      "-" +
      Math.random().toString(36).slice(2),
    file,
    url: URL.createObjectURL(file),
    type: file.type.startsWith("video/") ? "video" : "image",
  });

  const reorder = (list, from, to) => {
    const arr = [...list];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return arr;
  };

  const syncOrder = (newPreviews) => {
    setPreviewFiles(newPreviews);
    setFormData((prev) => ({
      ...prev,
      images: newPreviews.map((p) => p.file),
    }));
  };

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;

    if (name === "images" && files) {
      // revoke existing object URLs before replacing selection
      previewFiles.forEach((p) => URL.revokeObjectURL(p.url));

      const fileArray = Array.from(files);
      const previews = fileArray.map(buildPreview);
      setPreviewFiles(previews);
      setFormData((prev) => ({ ...prev, images: fileArray }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // --- Variation handlers ---
  const handleVariationChange = (index, field, value) => {
    setFormData((prev) => {
      const variations = [...prev.variations];
      variations[index] = { ...variations[index], [field]: value };
      return { ...prev, variations };
    });
  };

  const addVariation = () => {
    setFormData((prev) => ({
      ...prev,
      variations: [
        ...prev.variations,
        { name: "", price: "", stock: "", sku: "", discount: "" },
      ],
    }));
  };

  const removeVariation = (index) => {
    setFormData((prev) => {
      const variations = prev.variations.filter((_, i) => i !== index);
      return { ...prev, variations };
    });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.categories) newErrors.categories = "categories is required";

    if (formData.useVariations) {
      if (!formData.variations.length) {
        newErrors.variations = "Add at least one variation";
      } else {
        formData.variations.forEach((v, idx) => {
          if (!v.name.trim()) newErrors[`variation-name-${idx}`] = "Required";
          if (v.price === "") newErrors[`variation-price-${idx}`] = "Required";
          if (v.price !== "" && isNaN(v.price))
            newErrors[`variation-price-${idx}`] = "Must be a number";
          if (v.stock === "") newErrors[`variation-stock-${idx}`] = "Required";
          if (v.stock !== "" && isNaN(v.stock))
            newErrors[`variation-stock-${idx}`] = "Must be a number";
        });
      }
    } else {
      if (!formData.price) newErrors.price = "Price is required";
      if (formData.price && isNaN(formData.price))
        newErrors.price = "Price must be a number";
      if (!formData.stock) newErrors.stock = "Stock is required";
      if (formData.stock && isNaN(formData.stock))
        newErrors.stock = "Stock must be a number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // HTML → plain-text word/char count (for live counter)
  const descriptionStats = useMemo(() => {
    const plain = formData.description
      ? String(formData.description)
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    const words = plain ? plain.split(" ").length : 0;
    const chars = plain.length;
    return { words, chars };
  }, [formData.description]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      const uploadedMedia = [];

      // Upload in arranged order
      for (const file of formData.images) {
        const isVideo = file.type.startsWith("video/");
        if (!isVideo && !file.type.startsWith("image/")) {
          throw new Error(`File ${file.name} must be an image or video`);
        }
        const maxSize = isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(
            `${file.name} is too large (max ${isVideo ? "100MB" : "5MB"})`
          );
        }

        const response = await uploadMedia(file);
        const fileId = response?.$id ?? response;
        if (!fileId) throw new Error("Upload failed.");
        uploadedMedia.push(fileId);
      }

      const productData = {
        name: formData.name,
        title: formData.title,
        description: formData.description || "",
        price: formData.useVariations ? null : parseFloat(formData.price || 0),
        stock: formData.useVariations ? null : parseInt(formData.stock || 0),
        categories: formData.categories,
        brand: formData.brand,
        model: formData.model,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        is_featured: formData.is_featured,
        discount: parseFloat(formData.discount || 0),
        images: uploadedMedia, // in arranged order
        size: formData.size
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        type: formData.type,
        warranty: formData.warranty, // HTML from RTE
        shipping: formData.shipping, // HTML from RTE
        useVariations: formData.useVariations,
        variations: formData.useVariations
          ? formData.variations.map((v) =>
              JSON.stringify({
                name: v.name.trim(),
                price: parseFloat(v.price),
                stock: parseInt(v.stock),
                sku: v.sku?.trim() || null,
                discount: v.discount !== "" ? parseFloat(v.discount) : null,
              })
            )
          : [],
      };

      await productService.createProduct(productData);
      setSubmitSuccess(true);
      onSuccess && onSuccess();

      // reset
      setFormData({
        name: "",
        title: "",
        price: "",
        stock: "",
        categories: "",
        description: "",
        brand: "",
        model: "",
        tags: "",
        is_featured: false,
        discount: "0.0",
        images: [],
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
      previewFiles.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviewFiles([]);
      const inputEl = document.getElementById("images");
      if (inputEl) inputEl.value = "";
    } catch (err) {
      console.error("Submit error:", err);
      const msg = err.message.includes("Invalid relationship")
        ? "Invalid categories selection. Please try again."
        : err.message;
      setErrors({ submit: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="product-form p-4 grid gap-4 md:grid-cols-2"
    >
      {[
        ["name", "Product Name*", "text"],
        ["title", "Title*", "text"],
        ["brand", "Brand", "text"],
        ["model", "Model", "text"],
        ["tags", "Tags (comma separated)", "text"],
        ["discount", "Discount (%)", "number"],
        ["size", "Size (comma separated)", "text"],
        ["type", "Type", "text"],
        // removed warranty from this list; will render with RTE below
      ].map(([id, label, type]) => (
        <div className="form-group" key={id}>
          <label htmlFor={id}>{label}</label>
          <input
            type={type}
            id={id}
            name={id}
            value={formData[id]}
            onChange={handleChange}
            className={errors[id] ? "error" : ""}
          />
          {errors[id] && <span className="error-message">{errors[id]}</span>}
        </div>
      ))}

      {/* categories */}
      <div className="form-group">
        <label htmlFor="categories">categories*</label>
        <select
          id="categories"
          name="categories"
          value={formData.categories}
          onChange={handleChange}
          className={errors.categories ? "error" : ""}
        >
          <option value="">Select categories</option>
          {categories.map((cat) => (
            <option key={cat.$id} value={cat.name /* or cat.$id */}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.categories && (
          <span className="error-message">{errors.categories}</span>
        )}
      </div>

      {/* When not using variations, show base price/stock */}
      {!formData.useVariations && (
        <>
          <div className="form-group">
            <label htmlFor="price">Price*</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className={errors.price ? "error" : ""}
            />
            {errors.price && (
              <span className="error-message">{errors.price}</span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="stock">Stock*</label>
            <input
              type="number"
              id="stock"
              name="stock"
              value={formData.stock}
              onChange={handleChange}
              className={errors.stock ? "error" : ""}
            />
            {errors.stock && (
              <span className="error-message">{errors.stock}</span>
            )}
          </div>
        </>
      )}

      {/* DESCRIPTION (TinyMCE RTE) */}
      <div className="form-group" style={{ gridColumn: "span 2" }}>
        <label htmlFor="description">Description</label>
        <RTE
          label={false}
          value={formData.description}
          onChange={(content) =>
            setFormData((prev) => ({ ...prev, description: content }))
          }
        />
        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
          {descriptionStats.words} words • {descriptionStats.chars} characters
        </div>
      </div>

      {/* Featured */}
      <div className="form-group checkbox">
        <input
          type="checkbox"
          id="is_featured"
          name="is_featured"
          checked={formData.is_featured}
          onChange={handleChange}
        />
        <label htmlFor="is_featured">Featured Product</label>
      </div>

      {/* SHIPPING (RTE) */}
      <div className="form-group" style={{ gridColumn: "span 2" }}>
        <label htmlFor="shipping">Shipping Info</label>
        <RTE
          label={false}
          value={formData.shipping}
          onChange={(content) =>
            setFormData((prev) => ({ ...prev, shipping: content }))
          }
        />
      </div>

      {/* WARRANTY (RTE) */}
      <div className="form-group" style={{ gridColumn: "span 2" }}>
        <label htmlFor="warranty">Warranty</label>
        <RTE
          label={false}
          value={formData.warranty}
          onChange={(content) =>
            setFormData((prev) => ({ ...prev, warranty: content }))
          }
        />
      </div>

      {/* Media (images + videos) */}
      <div className="form-group" style={{ gridColumn: "span 2" }}>
        <label htmlFor="images">Product Media (Images/Videos)</label>
        <input
          type="file"
          id="images"
          name="images"
          onChange={handleChange}
          accept="image/*,video/*"
          multiple
        />
        <small>Images up to 5MB each, videos up to 100MB each.</small>
      </div>

      {/* Draggable Previews (arranged order) */}
      {previewFiles.length > 0 && (
        <div
          className="preview-container"
          style={{
            gridColumn: "span 2",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {previewFiles.map((item, i) => (
            <div
              key={item.id}
              className="preview-item"
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === i) return;
                const newPreviews = reorder(previewFiles, dragIndex, i);
                syncOrder(newPreviews);
                setDragIndex(null);
              }}
              style={{
                position: "relative",
                border: "1px dashed #d1d5db",
                padding: 6,
                borderRadius: 8,
                cursor: "grab",
                width: 212,
              }}
              title="Drag to reorder"
            >
              {item.type === "image" ? (
                <img src={item.url} alt={`Preview ${i + 1}`} width={200} />
              ) : (
                <video src={item.url} controls width={200} />
              )}

              {/* Remove */}
              <button
                type="button"
                className="remove-file"
                onClick={() => {
                  const filteredPreviews = previewFiles.filter(
                    (_, j) => j !== i
                  );
                  URL.revokeObjectURL(item.url);
                  syncOrder(filteredPreviews);
                }}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "black",
                  color: "white",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                }}
                aria-label={`Remove file ${i + 1}`}
              >
                ×
              </button>

              {/* Quick move controls (keyboard/mouse) */}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (i === 0) return;
                    syncOrder(reorder(previewFiles, i, i - 1));
                  }}
                  className="border px-2 py-1"
                  aria-label={`Move item ${i + 1} left`}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (i === previewFiles.length - 1) return;
                    syncOrder(reorder(previewFiles, i, i + 1));
                  }}
                  className="border px-2 py-1"
                  aria-label={`Move item ${i + 1} right`}
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Variations toggle */}
      <div className="form-group" style={{ gridColumn: "span 2" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            name="useVariations"
            checked={formData.useVariations}
            onChange={handleChange}
          />
          Use variations (e.g., Normal / Upgraded) with their own price & stock
        </label>
        {errors.variations && (
          <span className="error-message">{errors.variations}</span>
        )}
      </div>

      {/* Variations UI */}
      {formData.useVariations && (
        <div style={{ gridColumn: "span 2", display: "grid", gap: 12 }}>
          {formData.variations.map((v, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto",
                gap: 8,
                alignItems: "end",
              }}
            >
              <div>
                <label>Name*</label>
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) =>
                    handleVariationChange(idx, "name", e.target.value)
                  }
                  className={errors[`variation-name-${idx}`] ? "error" : ""}
                  placeholder="Normal / Upgraded"
                />
                {errors[`variation-name-${idx}`] && (
                  <span className="error-message">
                    {errors[`variation-name-${idx}`]}
                  </span>
                )}
              </div>
              <div>
                <label>Price*</label>
                <input
                  type="number"
                  value={v.price}
                  onChange={(e) =>
                    handleVariationChange(idx, "price", e.target.value)
                  }
                  className={errors[`variation-price-${idx}`] ? "error" : ""}
                  placeholder="e.g. 9999"
                />
                {errors[`variation-price-${idx}`] && (
                  <span className="error-message">
                    {errors[`variation-price-${idx}`]}
                  </span>
                )}
              </div>
              <div>
                <label>Stock*</label>
                <input
                  type="number"
                  value={v.stock}
                  onChange={(e) =>
                    handleVariationChange(idx, "stock", e.target.value)
                  }
                  className={errors[`variation-stock-${idx}`] ? "error" : ""}
                  placeholder="e.g. 50"
                />
                {errors[`variation-stock-${idx}`] && (
                  <span className="error-message">
                    {errors[`variation-stock-${idx}`]}
                  </span>
                )}
              </div>
              <div>
                <label>SKU</label>
                <input
                  type="text"
                  value={v.sku}
                  onChange={(e) =>
                    handleVariationChange(idx, "sku", e.target.value)
                  }
                  placeholder="Optional"
                />
              </div>
              <div>
                <label>Discount (%)</label>
                <input
                  type="number"
                  value={v.discount}
                  onChange={(e) =>
                    handleVariationChange(idx, "discount", e.target.value)
                  }
                  placeholder="Optional"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => removeVariation(idx)}
                  className="border px-3 py-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={addVariation}
              className="border px-3 py-2"
            >
              + Add Variation
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-black text-white border-2 p-2"
        style={{ gridColumn: "span 2", justifySelf: "start" }}
      >
        {isSubmitting ? "Submitting..." : "Submit"}
      </button>

      {errors.submit && (
        <div className="error-message" style={{ gridColumn: "span 2" }}>
          {errors.submit}
        </div>
      )}
      {submitSuccess && (
        <div className="success-message" style={{ gridColumn: "span 2" }}>
          Product added successfully!
        </div>
      )}
    </form>
  );
};

export default ProductForm;
