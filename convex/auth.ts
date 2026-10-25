import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";

// Email + password auth. Role is chosen at registration (student or senior);
// administrator accounts can only be created by the seed script.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const role = params.role as string | undefined;
        if (params.flow === "signUp" && role !== "student" && role !== "senior") {
          throw new ConvexError("Please choose whether you are a student or a senior.");
        }
        if (params.flow === "signUp" && params.ageConfirmed !== "true") {
          throw new ConvexError("Kindred is currently available to adults aged 18 and above.");
        }
        return {
          email: String(params.email).toLowerCase(),
          ...(params.name ? { name: String(params.name) } : {}),
          ...(role === "student" || role === "senior" ? { role } : {}),
        };
      },
      validatePasswordRequirements(password: string) {
        if (password.length < 8) throw new ConvexError("Passwords need at least 8 characters.");
      },
    }),
  ],
});
