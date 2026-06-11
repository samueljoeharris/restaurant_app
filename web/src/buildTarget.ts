/** True for ttf-admin-web (admin.dev) builds; false for public ttf-web. */
export const isAdminSite = import.meta.env.VITE_BUILD_TARGET === "admin";

export const defaultAuthedPath = isAdminSite ? "/admin" : "/restaurants";
