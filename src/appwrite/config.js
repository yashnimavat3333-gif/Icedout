// src/services/ProductService.js
import conf from "../conf/conf";
import { Databases, Client, ID, Storage, Query, Account } from "appwrite";

class ProductService {
    constructor() {
        this.client = new Client()
            .setEndpoint(conf.appwriteUrl)
            .setProject(conf.appwriteProjectId);

        this.databases = new Databases(this.client);
        this.storage = new Storage(this.client);
        this.account = new Account(this.client);
    }

    // ---------- (optional) ensure a session for private buckets ----------
    async ensureAnonymousSession() {
        try {
            await this.account.get(); // if already authed, this works
        } catch {
            await this.account.createAnonymousSession();
        }
    }

    // ---------- Helpers ----------
    toNumberOrNull(v) {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    toIntOrNull(v) {
        if (v === null || v === undefined || v === "") return null;
        const n = parseInt(String(v), 10);
        return Number.isFinite(n) ? n : null;
    }

    toBool(v) {
        return Boolean(v);
    }

    toStringArray(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v.map(String).filter(Boolean);
        if (typeof v === "string") {
            return v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }
        return [];
    }

    normalizeVariations(arr) {
        if (!arr || !Array.isArray(arr)) return [];
        return arr
            .map((v) => ({
                name: (v?.name || "").trim(),
                price: Number(v?.price),
                stock: parseInt(String(v?.stock || 0), 10),
                sku: v?.sku ? String(v.sku).trim() : null,
                discount:
                    v?.discount === undefined || v?.discount === null || v?.discount === ""
                        ? null
                        : Number(v.discount),
            }))
            .filter((v) => v.name && Number.isFinite(v.price) && Number.isFinite(v.stock));
    }

    // ---------- MEDIA ----------
    async uploadImage(file) {
        if (!file) throw new Error("No file provided");
        if (!file.type.startsWith("image/")) throw new Error("File must be an image");
        if (file.size > 5 * 1024 * 1024) throw new Error("Image must be < 5MB");
        const res = await this.storage.createFile(conf.appwriteBucketId, ID.unique(), file);
        return res.$id;
    }

    async uploadVideo(file) {
        if (!file) throw new Error("No file provided");
        if (!file.type.startsWith("video/")) throw new Error("File must be a video");
        if (file.size > 100 * 1024 * 1024) throw new Error("Video must be < 100MB");
        const res = await this.storage.createFile(conf.appwriteBucketId, ID.unique(), file);
        return res.$id;
    }

    async uploadFile(file) {
        if (file.type.startsWith("image/")) return this.uploadImage(file);
        if (file.type.startsWith("video/")) return this.uploadVideo(file);
        throw new Error("Only images or videos are allowed");
    }

    async deleteFile(fileId) {
        await this.storage.deleteFile(conf.appwriteBucketId, fileId);
        return true;
    }

    getFilePreview(fileId) {
        if (!fileId) return "";
        const u = this.storage.getFilePreview(conf.appwriteBucketId, fileId);
        return typeof u === "string" ? u : (u?.href || u?.toString() || "");
    }

    getFileView(fileId) {
        if (!fileId) return "";
        const u = this.storage.getFileView(conf.appwriteBucketId, fileId);
        return typeof u === "string" ? u : (u?.href || u?.toString() || "");
    }

    getDirectPreviewUrl(fileId) {
        if (!fileId) return "";
        const base = conf.appwriteUrl.replace(/\/v1\/?$/, ""); // normalize
        return `${base}/v1/storage/buckets/${conf.appwriteBucketId}/files/${fileId}/preview?project=${conf.appwriteProjectId}`;
    }

    getDirectViewUrl(fileId) {
        if (!fileId) return "";
        const base = conf.appwriteUrl.replace(/\/v1\/?$/, "");
        return `${base}/v1/storage/buckets/${conf.appwriteBucketId}/files/${fileId}/view?project=${conf.appwriteProjectId}`;
    }





    // ---------- PRODUCT CRUD ----------
    async createProduct(input) {
        try {
            let useVariations = this.toBool(input?.useVariations ?? true);
            let variations = Array.isArray(input?.variations) ? input.variations : [];

            // If UI sent objects, stringify them for string[] attribute
            if (variations.length && typeof variations[0] === "object") {
                const cleaned = this.normalizeVariations(variations);
                if (useVariations && cleaned.length === 0) {
                    useVariations = false;
                    variations = [];
                } else {
                    variations = cleaned.map((v) => JSON.stringify(v));
                }
            } else if (variations.length && typeof variations[0] === "string") {
                // Validate strings are JSON for safety (non-blocking)
                const parsed = variations
                    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
                    .filter(Boolean)
                    .filter((v) => v.name && Number.isFinite(Number(v.price)) && Number.isFinite(parseInt(v.stock)));
                if (useVariations && parsed.length === 0) {
                    useVariations = false;
                    variations = [];
                }
            }

            const documentData = {
                name: (input?.name || "").trim(),
                title: (input?.title || "").trim(),
                description: input?.description || "",
                is_featured: this.toBool(input?.is_featured),
                discount: this.toNumberOrNull(input?.discount) ?? 0,

                categories: input?.categories, // id or string per your schema

                brand: input?.brand || "",
                model: input?.model || "",
                tags: this.toStringArray(input?.tags),
                size: this.toStringArray(input?.size),
                type: input?.type || "",
                warranty: input?.warranty || "",
                shipping: input?.shipping || "",

                images: Array.isArray(input?.images) ? input.images : [],

                useVariations,
                variations, // string[]

                price: useVariations ? null : (this.toNumberOrNull(input?.price) ?? 0),
                stock: useVariations ? null : (this.toIntOrNull(input?.stock) ?? 0),
            };

            if (!documentData.name) throw new Error("Name is required");
            if (!documentData.title) throw new Error("Title is required");
            if (!documentData.categories) throw new Error("Categories is required");

            return await this.databases.createDocument(
                conf.appwriteDatabaseId,
                conf.appwriteProductCollectionId,
                ID.unique(),
                documentData
            );
        } catch (error) {
            console.error("ProductService::createProduct error", error);
            throw error;
        }
    }

    async updateProduct(documentId, updates = {}) {
        try {
            const patch = { ...updates };

            if ("price" in updates) patch.price = this.toNumberOrNull(updates.price);
            if ("stock" in updates) patch.stock = this.toIntOrNull(updates.stock);
            if ("discount" in updates) patch.discount = this.toNumberOrNull(updates.discount) ?? 0;
            if ("is_featured" in updates) patch.is_featured = this.toBool(updates.is_featured);
            if ("tags" in updates) patch.tags = this.toStringArray(updates.tags);
            if ("size" in updates) patch.size = this.toStringArray(updates.size);
            if ("images" in updates) patch.images = Array.isArray(updates.images) ? updates.images : [];
            if ("useVariations" in updates) patch.useVariations = this.toBool(updates.useVariations);

            if ("variations" in updates) {
                // Convert to string[] for schema
                const cleaned = this.normalizeVariations(updates.variations);
                patch.variations = cleaned.map((v) => JSON.stringify(v));
            }

            if ("shipping" in updates && typeof updates.shipping === "string") patch.shipping = updates.shipping;

            if ("name" in updates && typeof updates.name === "string") patch.name = updates.name.trim();
            if ("title" in updates && typeof updates.title === "string") patch.title = updates.title.trim();
            if ("description" in updates && typeof updates.description === "string") patch.description = updates.description;

            return await this.databases.updateDocument(
                conf.appwriteDatabaseId,
                conf.appwriteProductCollectionId,
                documentId,
                patch
            );
        } catch (error) {
            console.error("ProductService::updateProduct error", error);
            throw error;
        }
    }

    async getProduct(documentId) {
        try {
            return await this.databases.getDocument(
                conf.appwriteDatabaseId,
                conf.appwriteProductCollectionId,
                documentId
            );
        } catch (error) {
            console.error("ProductService::getProduct error", error);
            throw error;
        }
    }

    async deleteProduct(documentId) {
        try {
            await this.databases.deleteDocument(
                conf.appwriteDatabaseId,
                conf.appwriteProductCollectionId,
                documentId
            );
            return true;
        } catch (error) {
            console.error("ProductService::deleteProduct error", error);
            throw error;
        }
    }

    // ---------- LIST / SEARCH ----------
    async listProducts(params = {}) {
        const {
            categories,
            minPrice,
            maxPrice,
            featuredOnly = false,
            searchQuery,
            limit = 2000,
            cursor,
            cursorDirection = "after",
            tags = [],
        } = params;

        try {
            const queries = [];

            if (categories) {
                if (Array.isArray(categories)) queries.push(Query.equal("categories", categories));
                else queries.push(Query.equal("categories", categories));
            }

            if (typeof minPrice === "number") queries.push(Query.greaterThanEqual("price", minPrice));
            if (typeof maxPrice === "number") queries.push(Query.lessThanEqual("price", maxPrice));

            if (featuredOnly) queries.push(Query.equal("is_featured", true));
            if (searchQuery) queries.push(Query.search("name", searchQuery));
            if (tags && tags.length) queries.push(Query.contains("tags", tags));

            queries.push(Query.limit(limit));
            queries.push(Query.orderDesc("$createdAt"));

            if (cursor) {
                if (cursorDirection === "before") queries.push(Query.cursorBefore(cursor));
                else queries.push(Query.cursorAfter(cursor));
            }

            return await this.databases.listDocuments(
                conf.appwriteDatabaseId,
                conf.appwriteProductCollectionId,
                queries
            );
        } catch (error) {
            console.error("ProductService::listProducts error", error);
            throw error;
        }
    }

    // ---------- CATEGORIES ----------
    async listCategories() {
        try {
            return await this.databases.listDocuments(
                conf.appwriteDatabaseId,
                conf.appwriteCategoriesCollectionId
            );
        } catch (error) {
            console.error("ProductService::listCategories error", error);
            throw error;
        }
    }
}

const productService = new ProductService();
export default productService;
