import { useState } from "react";
import { ID } from "appwrite";
import productService from "../appwrite/config";
import conf from "../conf/conf";
import { bucket, databases } from "../conf";

const CreateCategoryForm = () => {
  const [formData, setFormData] = useState({ name: "", image: null });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      if (!formData.name?.trim()) {
        setError("Please provide a category name.");
        setLoading(false);
        return;
      }

      if (!formData.image) {
        setError("Please choose an image file.");
        setLoading(false);
        return;
      }

      // Upload image to bucket
      let uploadedFile = null;
      try {
        uploadedFile = await bucket.createFile(
          conf.appwriteBucketId,
          ID.unique(),
          formData.image
        );
      } catch (uploadErr) {
        console.error("File upload failed:", uploadErr);
        setError("Image upload failed. Try again.");
        setLoading(false);
        return;
      }

      // Build a preview URL if needed (not used for Appwrite Files field)
      let imageUrl = "";
      try {
        const preview = bucket.getFilePreview(
          conf.appwriteBucketId,
          uploadedFile.$id
        );
        // Some Appwrite SDKs return an object, some return a URL string — handle both
        imageUrl = preview?.href ?? preview ?? "";
      } catch (previewErr) {
        // Non-fatal — preview retrieval may not be available or may require auth
        console.debug("Preview retrieval failed:", previewErr);
      }

      // Prepare useful values
      const fileId = uploadedFile?.$id ?? null;
      if (!fileId) {
        console.error("Uploaded file missing $id", uploadedFile);
        setError("Upload did not return a file id.");
        setLoading(false);
        return;
      }

      // Candidate payloads we'll try (ordered)
      const payloadCandidates = [
        // If your collection expects a string (URL)
        {
          name: formData.name,
          image:
            imageUrl ||
            `https://fra.cloud.appwrite.io/v1/storage/buckets/${conf.appwriteBucketId}/files/${fileId}/view?project=${conf.appwriteProjectId}`,
        },

        // If collection expects a single file-id string
        { name: formData.name, image: fileId },

        // If collection expects Appwrite Files format (array of file ids)
        { name: formData.name, image: [fileId] },

        // fallback: store both
        { name: formData.name, image: fileId, imageUrl },
      ];

      let created = null;
      let lastErr = null;

      for (const payload of payloadCandidates) {
        try {
          created = await databases.createDocument(
            conf.appwriteDatabaseId,
            conf.appwriteCategoriesCollectionId,
            ID.unique(),
            payload
          );
          // created successfully — break
          break;
        } catch (docErr) {
          // Save the last error for reporting and try next payload shape
          lastErr = docErr;
          console.debug(
            "createDocument attempt failed for payload:",
            payload,
            docErr
          );
        }
      }

      if (!created) {
        console.error("All createDocument attempts failed:", lastErr);
        // Try to extract a helpful error message from Appwrite response
        const msg =
          lastErr?.message ||
          lastErr?.response ||
          "Failed to create category — server rejected the document shape.";
        setError(msg);
        setLoading(false);
        return;
      }

      setSuccess("Category created successfully!");
      setFormData({ name: "", image: null });
    } catch (err) {
      console.error("Unexpected error in handleSubmit:", err);
      setError("Failed to create category.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-lg mt-10">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">
        Create New Category
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-gray-700 mb-1 font-medium">Name</label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
            placeholder="e.g. Bracelets"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1 font-medium">Image</label>
          <input
            type="file"
            name="image"
            accept="image/*"
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Category"}
        </button>

        {success && <p className="text-green-600 text-sm mt-3">{success}</p>}
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </form>
    </div>
  );
};

export default CreateCategoryForm;
