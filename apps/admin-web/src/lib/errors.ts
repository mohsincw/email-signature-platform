import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ message: err.message }, { status: err.status });
  }
  console.error("Unhandled API error:", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ message }, { status: 500 });
}
