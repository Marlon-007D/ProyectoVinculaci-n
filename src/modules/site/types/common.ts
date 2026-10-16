export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };
