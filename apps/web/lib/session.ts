// The curator's access code lives in this httpOnly cookie (set by the sign-in
// action in app/actions.ts); their display name in a second one. Kept free of
// imports so middleware can use it.
export const SESSION_COOKIE = "haqdaar_admin";
export const NAME_COOKIE = "haqdaar_admin_name";
