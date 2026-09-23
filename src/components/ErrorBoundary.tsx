import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * آخر شبكة أمان للواجهة: خطأ عرضٍ واحد كان يُسقط الشجرة كلها إلى صفحة بيضاء
 * بلا مخرج. هنا يرى المستخدم رسالة وزر إعادة تحميل بدل ذلك.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const ar = document.documentElement.dir === "rtl";
    return (
      <div role="alert" dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "inherit", textAlign: "center" }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
            {ar ? "حدث خطأ غير متوقع" : "Something went wrong"}
          </h1>
          <p style={{ marginBottom: 20, opacity: 0.8 }}>
            {ar ? "لم يُفقد عملك المحفوظ. أعد تحميل الصفحة للمتابعة." : "Your saved work is safe. Reload the page to continue."}
          </p>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid currentColor", cursor: "pointer" }}>
            {ar ? "إعادة التحميل" : "Reload"}
          </button>
        </div>
      </div>
    );
  }
}
