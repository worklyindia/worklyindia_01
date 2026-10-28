import { ErrorCodeReference, OAUTH_ERRORS } from "@/components/docs/ErrorCodeReference";
import { useEffect, useState } from "react";
import CopyPageButton from "@/components/docs/CopyPageButton";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronRight, Code2, Globe, KeyRound, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SampleBlock, SectionHeading } from "./WhatsAppDocs";

type Sample = { title: string; description: string; code: string };

const AUTH = "https://jubwzelupbntbetpajqb.supabase.co/auth/v1";

const endpoints = [
  ["Issuer", AUTH],
  ["Authorization endpoint", `${AUTH}/oauth/authorize`],
  ["Token endpoint", `${AUTH}/oauth/token`],
  ["UserInfo endpoint", `${AUTH}/oauth/userinfo`],
  ["JWKS endpoint", `${AUTH}/.well-known/jwks.json`],
  ["OIDC discovery", `${AUTH}/.well-known/openid-configuration`],
  ["Dynamic client registration", `${AUTH}/oauth/clients/register`],
];

const sectionLinks = [
  { href: "#overview", label: "Overview", icon: ShieldCheck },
  { href: "#flow", label: "How it works", icon: Workflow },
  { href: "#endpoints", label: "Endpoints", icon: Globe },
  { href: "#register", label: "Register your app", icon: KeyRound },
  { href: "#login", label: "Add login button", icon: Code2 },
  { href: "#token", label: "Get tokens & user", icon: KeyRound },
  { href: "#examples", label: "Website examples", icon: Code2 },
  { href: "#errors", label: "Troubleshooting", icon: AlertTriangle },
];

const loginSamples: Sample[] = [
  {
    title: "Step 1 — create PKCE verifier + challenge (Node.js)",
    description: "Make a fresh code_verifier and state for every login. Keep both in the user's session.",
    code: `import crypto from "crypto";
const b64url = (b) => b.toString("base64").replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
const codeVerifier = b64url(crypto.randomBytes(32));
const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
const state = b64url(crypto.randomBytes(16));`,
  },
  {
    title: "Step 2 — send the user to Workly India",
    description: "Your \"Login with Workly India\" button opens this URL. The user signs in and sees the Allow / Deny screen.",
    code: `${AUTH}/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yourwebsite.com/auth/callback&
  scope=openid%20email%20profile&
  state=STATE&
  code_challenge=CODE_CHALLENGE&
  code_challenge_method=S256`,
  },
];

const tokenSamples: Sample[] = [
  {
    title: "Step 3 — exchange the code for tokens",
    description: "Your callback receives ?code=...&state=... . Check state matches, then call the token endpoint from your server.",
    code: `curl -X POST ${AUTH}/oauth/token \\
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=CODE_FROM_CALLBACK" \\
  -d "redirect_uri=https://yourwebsite.com/auth/callback" \\
  -d "code_verifier=CODE_VERIFIER"

# Response
{ "access_token": "eyJ...", "token_type": "bearer", "expires_in": 3600,
  "refresh_token": "...", "id_token": "eyJ...", "scope": "openid email profile" }`,
  },
  {
    title: "Step 4 — read the signed-in user",
    description: "Use the access token to get the user's id and email.",
    code: `curl ${AUTH}/oauth/userinfo \\
  -H "Authorization: Bearer ACCESS_TOKEN"

# { "sub": "user-uuid", "email": "user@example.com", "email_verified": true, ... }`,
  },
  {
    title: "Refresh an expired access token",
    description: "Access tokens last about 1 hour. Use the refresh token to get a new one.",
    code: `curl -X POST ${AUTH}/oauth/token \\
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=REFRESH_TOKEN"`,
  },
];

const exampleSamples: Sample[] = [
  {
    title: "Node.js / Express — full login",
    description: "Complete \"Login with Workly India\" for a server website. Put CLIENT_ID and CLIENT_SECRET in env vars.",
    code: `import express from "express";
import session from "express-session";
import crypto from "crypto";

const AUTH = "${AUTH}";
const REDIRECT = "https://yourwebsite.com/auth/callback";
const app = express();
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
const b64url = (b) => b.toString("base64url");

app.get("/login", (req, res) => {
  const verifier = b64url(crypto.randomBytes(32));
  const state = b64url(crypto.randomBytes(16));
  req.session.oauth = { verifier, state };
  const url = new URL(AUTH + "/oauth/authorize");
  url.search = new URLSearchParams({
    response_type: "code", client_id: process.env.CLIENT_ID, redirect_uri: REDIRECT,
    scope: "openid email profile", state,
    code_challenge: b64url(crypto.createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
  });
  res.redirect(url.toString());
});

app.get("/auth/callback", async (req, res) => {
  const saved = req.session.oauth;
  if (!saved || req.query.state !== saved.state) return res.status(400).send("Bad state");
  if (req.query.error) return res.status(400).send("Login cancelled");
  const r = await fetch(AUTH + "/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code: req.query.code, redirect_uri: REDIRECT, code_verifier: saved.verifier }),
  });
  const tokens = await r.json();
  if (!r.ok) return res.status(400).json(tokens);
  const user = await (await fetch(AUTH + "/oauth/userinfo", { headers: { Authorization: "Bearer " + tokens.access_token } })).json();
  req.session.user = { id: user.sub, email: user.email };
  res.redirect("/");
});

app.listen(3000);`,
  },
  {
    title: "Next.js / Auth.js (NextAuth) provider",
    description: "Uses OIDC discovery, so endpoints are found automatically.",
    code: `// auth.ts
import NextAuth from "next-auth";
export const { handlers, auth, signIn } = NextAuth({
  providers: [{
    id: "workly", name: "Workly India", type: "oidc",
    issuer: "${AUTH}",
    clientId: process.env.WORKLY_CLIENT_ID,
    clientSecret: process.env.WORKLY_CLIENT_SECRET,
    authorization: { params: { scope: "openid email profile" } },
    checks: ["pkce", "state"],
  }],
});
// Redirect URI to register: https://yourwebsite.com/api/auth/callback/workly`,
  },
  {
    title: "PHP — league/oauth2-client",
    description: "composer require league/oauth2-client",
    code: `<?php
session_start();
$provider = new \\League\\OAuth2\\Client\\Provider\\GenericProvider([
  'clientId' => getenv('CLIENT_ID'), 'clientSecret' => getenv('CLIENT_SECRET'),
  'redirectUri' => 'https://yourwebsite.com/callback.php',
  'urlAuthorize' => '${AUTH}/oauth/authorize',
  'urlAccessToken' => '${AUTH}/oauth/token',
  'urlResourceOwnerDetails' => '${AUTH}/oauth/userinfo',
  'scopes' => 'openid email profile', 'pkceMethod' => 'S256',
]);
if (!isset($_GET['code'])) {
  $url = $provider->getAuthorizationUrl();
  $_SESSION['state'] = $provider->getState();
  $_SESSION['pkce'] = $provider->getPkceCode();
  header('Location: ' . $url); exit;
}
if ($_GET['state'] !== $_SESSION['state']) exit('Bad state');
$provider->setPkceCode($_SESSION['pkce']);
$token = $provider->getAccessToken('authorization_code', ['code' => $_GET['code']]);
$user = $provider->getResourceOwner($token)->toArray();
echo 'Hello ' . htmlspecialchars($user['email']);`,
  },
  {
    title: "Python — Authlib (Flask)",
    description: "pip install authlib flask requests",
    code: `from flask import Flask, url_for, session, redirect
from authlib.integrations.flask_client import OAuth
import os
app = Flask(__name__); app.secret_key = os.environ["SESSION_SECRET"]
oauth = OAuth(app)
oauth.register("workly",
  client_id=os.environ["CLIENT_ID"], client_secret=os.environ["CLIENT_SECRET"],
  server_metadata_url="${AUTH}/.well-known/openid-configuration",
  client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"})

@app.route("/login")
def login():
    return oauth.workly.authorize_redirect(url_for("callback", _external=True))

@app.route("/auth/callback")
def callback():
    token = oauth.workly.authorize_access_token()
    session["user"] = token.get("userinfo")
    return redirect("/")`,
  },
  {
    title: "Verify an access token on your API",
    description: "Check the JWT signature with the JWKS endpoint (Node.js, jose).",
    code: `import { createRemoteJWKSet, jwtVerify } from "jose";
const JWKS = createRemoteJWKSet(new URL("${AUTH}/.well-known/jwks.json"));
export async function verify(token) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: "${AUTH}" });
  return payload; // payload.sub = user id, payload.client_id = your app
}`,
  },
];

const OAuthDocs = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (section) window.requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView());
  }, []);

  const copy = async (code: string, title: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(title);
      window.setTimeout(() => setCopied(null), 2000);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const B = ({ children }: { children: React.ReactNode }) => <strong className="text-foreground">{children}</strong>;
  const Steps = ({ items }: { items: React.ReactNode[] }) => (
    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ol>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Workly India OAuth</h1>
        <CopyPageButton title={"Workly India OAuth"} />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">Login with Workly India</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Let users sign in to your own website with their Workly India account using OAuth 2.1 and OpenID Connect — like "Login with Google".
        </p>

        <nav aria-label="Documentation sections" className="mt-6 grid grid-cols-1 gap-2 border-y border-border py-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {sectionLinks.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="group flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 leading-5">{label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </a>
          ))}
        </nav>

        <section id="overview" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={ShieldCheck} title="Overview" />
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Workly India works as an <B>OAuth 2.1 / OpenID Connect identity provider</B>.</li>
            <li>Your website gets the user's <B>id, email and profile</B> after they press <B>Allow</B> on the Workly India consent screen.</li>
            <li>Uses <B>Authorization Code + PKCE</B>. Supported scopes: <code>openid</code>, <code>email</code>, <code>profile</code>, <code>offline_access</code> (refresh token).</li>
            <li><B>Phone numbers are never shared.</B> The <code>phone</code> scope is not offered — a login gives you only the id, email and profile the user approves.</li>
            <li>Keep the <B>client secret</B> and tokens on your server only — never in browser JavaScript.</li>
          </ul>
        </section>

        <section id="flow" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Workflow} title="How it works" />
          <Steps items={[
            <>User clicks <B>Login with Workly India</B> on your website.</>,
            <>Your site redirects to the <B>authorization endpoint</B>.</>,
            <>User signs in on Workly India and sees the <B>Allow / Deny</B> screen (<code>/oauth/consent</code>).</>,
            <>Workly India redirects back to your <B>redirect URI</B> with a one-time <code>code</code>.</>,
            <>Your server exchanges the code at the <B>token endpoint</B> for an access token, refresh token and ID token.</>,
            <>Your server calls <B>userinfo</B> and logs the user in.</>,
          ]} />
        </section>

        <section id="endpoints" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Globe} title="Endpoints" />
          <div className="mt-4 space-y-3">
            {endpoints.map(([name, url]) => (
              <button key={name} type="button" onClick={() => copy(url, name)} className="block w-full rounded-md border border-border bg-card p-3 text-left text-sm hover:bg-muted">
                <p className="font-medium">{name}</p>
                <code className="mt-1 block break-all text-xs text-muted-foreground">{url}</code>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Tap any endpoint to copy it.</p>
        </section>

        <section id="register" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={KeyRound} title="Register your app" />
          <Steps items={[
            <>On the Developer Portal home, choose <B>Create OAuth App</B>. Enter your <B>app name</B> and <B>redirect URL</B> to receive a <B>client_id</B> and (for server apps) a <B>client_secret</B>.</>,
            <>Choose type: <B>Confidential</B> (server websites, has a secret) or <B>Public</B> (single-page/mobile apps, PKCE only, no secret).</>,
            <>Redirect URI must match <B>exactly</B> (https, same path, no extra slash).</>,
          ]} />
        </section>

        <section id="login" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Code2} title="Add the login button" />
          {loginSamples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={copy} />)}
          <SampleBlock sample={{ title: "Button HTML", description: "Point it to your own /login route (it builds the URL above).", code: `<a href="/login" class="workly-login">Login with Workly India</a>` }} copied={copied} onCopy={copy} />
        </section>

        <section id="token" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={KeyRound} title="Get tokens & user" />
          {tokenSamples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={copy} />)}
        </section>

        <section id="examples" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Code2} title="Website examples" />
          {exampleSamples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={copy} />)}
        </section>

        <section id="errors" className="scroll-mt-20 py-8">
          <SectionHeading icon={AlertTriangle} title="Troubleshooting" />
          <ErrorCodeReference errors={OAUTH_ERRORS} />
        </section>
      </main>
    </div>
  );
};

export default OAuthDocs;
