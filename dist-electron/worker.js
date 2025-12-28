import { workerData, parentPort } from "worker_threads";
import path from "node:path";
import fs from "node:fs/promises";
async function scanDir(dir) {
  let fileList = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      parentPort.postMessage({ type: "progress", path: fullPath });
      if (entry.isDirectory()) {
        const subFiles = await scanDir(fullPath);
        fileList = [...fileList, ...subFiles];
      } else {
        const ext = path.extname(fullPath);
        fileList.push(fullPath);
      }
    }
  } catch (error) {
    parentPort.postMessage({ type: "error", path: dir, msg: err.message });
  }
  return fileList;
}
scanDir(workerData.path).then((allFiles) => {
  parentPort.postMessage({ type: "complete", files: allFiles });
  parentPort.close();
}).catch((err2) => {
  parentPort.close();
});
