// Safe environment variable access with fallbacks
const getEnv = (key, fallback = "") => {
    const value = import.meta.env[key];
    return value ? String(value) : fallback;
};

const conf = {
    appwriteUrl: getEnv("VITE_APPWRITE_URL", "https://cloud.appwrite.io/v1"),
    appwriteProjectId: getEnv("VITE_APPWRITE_PROJECT_ID", ""),
    appwriteDatabaseId: getEnv("VITE_APPWRITE_DATABASE_ID", ""),

    appwriteProductCollectionId: getEnv("VITE_APPWRITE_COLLECTION_ID", ""),
    appwriteBucketId: getEnv("VITE_APPWRITE_BUCKET_ID", ""),
    appwriteReviewBucketId: getEnv("VITE_APPWRITE_REVIEW_BUCKET_ID", ""),
    appwriteCategoriesCollectionId: getEnv("VITE_APPWRITE_CATEGORY_COLLECTION_ID", ""),
    appwriteReviewsCollectionId: getEnv("VITE_APPWRITE_REVIEWS_COLLECTION_ID", ""),

    // FIX: convert comma-separated string → array of admin IDs
    adminUserIds: import.meta.env.VITE_APPWRITE_ADMIN_USER_IDS
        ? String(import.meta.env.VITE_APPWRITE_ADMIN_USER_IDS).split(",").map(s => s.trim())
        : [],
};

export default conf;
