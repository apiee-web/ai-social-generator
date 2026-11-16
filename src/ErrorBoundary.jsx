/**
 * ErrorBoundary.jsx — last line of defence against a blank page.
 * ---------------------------------------------------------------------------
 * React unmounts the whole tree when a render throws, which leaves a white
 * screen and no explanation. The verification link is the one entry point a
 * visitor arrives at from outside the app — an email button, in whatever
 * browser their mail client opened — so a crash there must still show something
 * clickable instead of nothing at all.
 *
 * Requires: React 18+.
 * ---------------------------------------------------------------------------
 */

import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[ui]", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        className="aisg"
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 460 }}>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>This page hit a problem</h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#5b5b73" }}>
            Reloading usually fixes it, and your account, plan and credits are untouched. If your
            verification link was already used, sign in and request a new one from the yellow banner.
          </p>
          <p style={{ marginTop: 18 }}>
            <a className="aisg-btn aisg-btn-primary" href="/">
              Reload OmniContext AI
            </a>
          </p>
        </div>
      </div>
    );
  }
}
