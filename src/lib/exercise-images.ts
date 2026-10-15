// The workout library's pictures come from the open free-exercise-db project
// (public domain), served from its own hosting instead of being stored here.
const BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export const exerciseImage = (path: string) => `${BASE}/${path}`;
