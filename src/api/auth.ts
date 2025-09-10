import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";

export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  if (!env.JWT_SECRET) return;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const token = header.slice("Bearer ".length);
  try {
    jwt.verify(token, env.JWT_SECRET);
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}
