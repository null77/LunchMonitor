import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
export default defineConfig({
    plugins: [preact()],
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
    server: {
        port: 3000,
        open: true,
    },
});
//# sourceMappingURL=vite.config.js.map