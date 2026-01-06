const conf = {
    appwriteUrl: String(import.meta.env.VITE_APPWRITE_URL),
    appwriteProjectId: String(import.meta.env.VITE_APPWRITE_PROJECT_ID),
    appwriteDatabaseId: String(import.meta.env.VITE_APPWRITE_DATABASE_ID),

    appwriteProductCollectionId: String(import.meta.env.VITE_APPWRITE_COLLECTION_ID),
    appwriteBucketId: String(import.meta.env.VITE_APPWRITE_BUCKET_ID),
    appwriteReviewBucketId: String(import.meta.env.VITE_APPWRITE_REVIEW_BUCKET_ID),
    appwriteCategoriesCollectionId: String(import.meta.env.VITE_APPWRITE_CATEGORY_COLLECTION_ID),
    appwriteReviewsCollectionId: String(import.meta.env.VITE_APPWRITE_REVIEWS_COLLECTION_ID),

    // FIX: convert comma-separated string → array of admin IDs
    adminUserIds: import.meta.env.VITE_APPWRITE_ADMIN_USER_IDS
        ? String(import.meta.env.VITE_APPWRITE_ADMIN_USER_IDS).split(",").map(s => s.trim())
        : [],
};

export default conf;
