import jwt from "jsonwebtoken";

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "smart-deals-37b05";

const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache = {
  certs: null,
  expiresAt: 0,
};

const getSigningCertificates = async (forceRefresh = false) => {
  const now = Date.now();

  if (
    !forceRefresh &&
    certCache.certs &&
    certCache.expiresAt > now
  ) {
    return certCache.certs;
  }

  const response = await fetch(CERT_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch Firebase signing certificates (${response.status})`);
  }

  const certs = await response.json();
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = Number(maxAgeMatch?.[1] || 3600);

  certCache = {
    certs,
    expiresAt: now + Math.max(300, maxAgeSeconds) * 1000,
  };

  return certs;
};

const getCertificateForToken = async (kid) => {
  let certs = await getSigningCertificates();

  if (!certs[kid]) {
    certs = await getSigningCertificates(true);
  }

  const cert = certs[kid];

  if (!cert) {
    throw new Error("Firebase signing key not found");
  }

  return cert;
};

export const verifyFirebaseIdToken = async (token) => {
  const decoded = jwt.decode(token, { complete: true });

  if (
    !decoded ||
    typeof decoded !== "object" ||
    decoded.header?.alg !== "RS256" ||
    !decoded.header?.kid
  ) {
    throw new Error("Invalid Firebase token header");
  }

  const certificate = await getCertificateForToken(decoded.header.kid);

  const payload = jwt.verify(token, certificate, {
    algorithms: ["RS256"],
    audience: FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
  });

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 128
  ) {
    throw new Error("Invalid Firebase token subject");
  }

  if (typeof payload.iat !== "number" || payload.iat > nowSeconds + 300) {
    throw new Error("Invalid Firebase token issue time");
  }

  if (
    typeof payload.auth_time === "number" &&
    payload.auth_time > nowSeconds + 300
  ) {
    throw new Error("Invalid Firebase token auth time");
  }

  return {
    ...payload,
    uid: payload.sub,
    email_verified: Boolean(payload.email_verified),
  };
};

export const verifyFirebase = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.firebaseUser = await verifyFirebaseIdToken(token);
    return next();
  } catch (error) {
    console.error("Firebase token verification failed:", error?.message);
    return res.status(401).send({ message: "Invalid Firebase token" });
  }
};
