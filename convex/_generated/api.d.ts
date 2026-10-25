/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as calls from "../calls.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as lamb from "../lamb.js";
import type * as lambAI from "../lambAI.js";
import type * as learning from "../learning.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_cartesia from "../lib/cartesia.js";
import type * as lib_concepts from "../lib/concepts.js";
import type * as lib_heuristics from "../lib/heuristics.js";
import type * as lib_lambLadder from "../lib/lambLadder.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_time from "../lib/time.js";
import type * as matching from "../matching.js";
import type * as memories from "../memories.js";
import type * as mossSync from "../mossSync.js";
import type * as pipeline from "../pipeline.js";
import type * as pipelineData from "../pipelineData.js";
import type * as practice from "../practice.js";
import type * as practiceAI from "../practiceAI.js";
import type * as scheduling from "../scheduling.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  calls: typeof calls;
  http: typeof http;
  integrations: typeof integrations;
  lamb: typeof lamb;
  lambAI: typeof lambAI;
  learning: typeof learning;
  "lib/authz": typeof lib_authz;
  "lib/cartesia": typeof lib_cartesia;
  "lib/concepts": typeof lib_concepts;
  "lib/heuristics": typeof lib_heuristics;
  "lib/lambLadder": typeof lib_lambLadder;
  "lib/llm": typeof lib_llm;
  "lib/time": typeof lib_time;
  matching: typeof matching;
  memories: typeof memories;
  mossSync: typeof mossSync;
  pipeline: typeof pipeline;
  pipelineData: typeof pipelineData;
  practice: typeof practice;
  practiceAI: typeof practiceAI;
  scheduling: typeof scheduling;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
