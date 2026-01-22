import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

async function uploadVideo() {
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",") || [];
  if (publicPaths.length === 0) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  }
  
  const firstPath = publicPaths[0].trim();
  const pathParts = firstPath.split("/").filter(p => p.length > 0);
  const bucketName = pathParts[0];
  const publicDir = pathParts.slice(1).join("/");
  
  console.log("Bucket:", bucketName);
  console.log("Public dir:", publicDir);
  
  const bucket = storageClient.bucket(bucketName);
  const videoPath = "attached_assets/How_to_Effectively_Use_the_Leashield_App_for_Background_Checks_1769098947245.mp4";
  const destName = publicDir + "/leaseshield-walkthrough.mp4";
  
  console.log("Uploading to:", destName);
  
  await bucket.upload(videoPath, {
    destination: destName,
    contentType: "video/mp4",
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });
  
  console.log("Upload complete!");
  console.log("Video will be available at: /public/leaseshield-walkthrough.mp4");
}

uploadVideo().catch(console.error);
