import { Client, Databases, Storage, Account } from "appwrite";
import conf from "./conf";

// Create main Appwrite client instance
const client = new Client()
    .setEndpoint(conf.appwriteUrl)
    .setProject(conf.appwriteProjectId);

// Export Appwrite services
const databases = new Databases(client);
const bucket = new Storage(client);
const account = new Account(client);

export { databases, bucket, account };
