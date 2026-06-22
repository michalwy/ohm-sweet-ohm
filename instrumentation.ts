export async function register() {
  if (process.env.OSO_E2E_SUPPLIER_FIXTURE) {
    process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNRESET" || err.message === "aborted") return;
      throw err;
    });
  }
}
