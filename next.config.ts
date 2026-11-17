import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version?: string;
  dependencies?: {
    next?: string;
    react?: string;
  };
};

function readGitCommand(cmd: string, fallback: string): string {
  try {
    return (
      execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  readGitCommand("git rev-parse --short HEAD", "local");

const commitBranch =
  process.env.VERCEL_GIT_COMMIT_REF ||
  readGitCommand("git rev-parse --abbrev-ref HEAD", "main");

const deployEnv = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV
  : process.env.NODE_ENV === "production"
    ? "production"
    : "development";

const buildDateFormatted = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
}).format(new Date());

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? "0.1.0",
    NEXT_PUBLIC_NEXT_VERSION: (pkg.dependencies?.next ?? "16.4.6").replace(/^[^0-9]*/, ""),
    NEXT_PUBLIC_REACT_VERSION: (pkg.dependencies?.react ?? "19.3.0").replace(/^[^0-9]*/, ""),
    NEXT_PUBLIC_GIT_COMMIT: commitSha,
    NEXT_PUBLIC_GIT_BRANCH: commitBranch,
    NEXT_PUBLIC_DEPLOY_ENV: deployEnv,
    NEXT_PUBLIC_BUILD_TIME: buildDateFormatted,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
