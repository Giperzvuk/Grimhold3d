package com.grimhold.game;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.graphics.Color;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setUserAgentString(s.getUserAgentString() + " GrimholdApp/1.0");
        web.addJavascriptInterface(new TtsBridge(), "GrimholdTTS");
        web.addJavascriptInterface(new NetBridge(), "GrimholdNet");
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        hideBars();
    }


    // ---- Мост озвучки: HTTP-запрос делает нативный код, поэтому CORS не мешает ----
    private final java.util.Map<String, byte[]> ttsData = new java.util.concurrent.ConcurrentHashMap<String, byte[]>();
    private final java.util.Map<String, String> ttsErr = new java.util.concurrent.ConcurrentHashMap<String, String>();

    private static String jsQuote(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c == '\n') b.append("\\n");
            else if (c == '\r') b.append("\\r");
            else if (c < 0x20 || c > 0x7e) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    public class TtsBridge {
        @android.webkit.JavascriptInterface
        public boolean available() { return true; }

        @android.webkit.JavascriptInterface
        public void request(final String id, final String url, final String auth, final String model, final String body) {
            new Thread(new Runnable() { public void run() {
                java.net.HttpURLConnection c = null; String err = null; byte[] data = null;
                try {
                    c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(15000); c.setReadTimeout(90000);
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setRequestProperty("Accept", "*/*");
                    if (auth != null && auth.length() > 0) c.setRequestProperty("Authorization", auth);
                    if (model != null && model.length() > 0) c.setRequestProperty("model", model);
                    c.setDoOutput(true);
                    byte[] out = body.getBytes("UTF-8");
                    c.setFixedLengthStreamingMode(out.length);
                    java.io.OutputStream os = c.getOutputStream(); os.write(out); os.flush(); os.close();
                    int code = c.getResponseCode();
                    if (code != 200) {
                        err = "HTTP " + code;
                    } else {
                        java.io.InputStream is = c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[16384]; int n;
                        while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
                        is.close(); data = bo.toByteArray();
                        if (data.length < 64) err = "пустой ответ";
                    }
                } catch (Exception e) {
                    String m = e.getMessage();
                    err = e.getClass().getSimpleName() + (m != null ? ": " + m : "");
                } finally { if (c != null) c.disconnect(); }
                if (err != null) ttsErr.put(id, err); else ttsData.put(id, data);
                final String fid = id;
                web.post(new Runnable() { public void run() {
                    web.evaluateJavascript("window.Voice && Voice._nativeDone(" + jsQuote(fid) + ")", null);
                } });
            } }).start();
        }

        @android.webkit.JavascriptInterface
        public String error(String id) { return ttsErr.get(id); }

        @android.webkit.JavascriptInterface
        public int size(String id) { byte[] d = ttsData.get(id); return d == null ? 0 : d.length; }

        // выдаём звук кусками: строка через мост ограничена по размеру
        @android.webkit.JavascriptInterface
        public String chunk(String id, int off, int len) {
            byte[] d = ttsData.get(id); if (d == null || off >= d.length) return "";
            int n = Math.min(len, d.length - off);
            return android.util.Base64.encodeToString(d, off, n, android.util.Base64.NO_WRAP);
        }

        @android.webkit.JavascriptInterface
        public void done(String id) { ttsData.remove(id); ttsErr.remove(id); }
    }


    // ---- Мост обновления: текстовый GET, загрузка APK с прогрессом и запуск установщика ----
    private final java.util.Map<String, String> netTxt = new java.util.concurrent.ConcurrentHashMap<String, String>();
    private final java.util.Map<String, String> netErr = new java.util.concurrent.ConcurrentHashMap<String, String>();
    private final java.util.Map<String, Boolean> netStop = new java.util.concurrent.ConcurrentHashMap<String, Boolean>();

    private void js(final String code) {
        web.post(new Runnable() { public void run() { web.evaluateJavascript(code, null); } });
    }

    public class NetBridge {
        @android.webkit.JavascriptInterface
        public boolean available() { return true; }

        @android.webkit.JavascriptInterface
        public void get(final String id, final String url) {
            new Thread(new Runnable() { public void run() {
                java.net.HttpURLConnection c = null; String err = null, txt = null;
                try {
                    c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setRequestMethod("GET");
                    c.setConnectTimeout(12000); c.setReadTimeout(20000);
                    c.setRequestProperty("Accept", "application/json, text/plain, */*");
                    c.setRequestProperty("User-Agent", "Grimhold3D");
                    int code = c.getResponseCode();
                    if (code != 200) err = "HTTP " + code;
                    else {
                        java.io.InputStream is = c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[8192]; int n;
                        while ((n = is.read(buf)) > 0) { bo.write(buf, 0, n); if (bo.size() > 1048576) break; }
                        is.close(); txt = new String(bo.toByteArray(), "UTF-8");
                    }
                } catch (Exception e) {
                    String m = e.getMessage();
                    err = e.getClass().getSimpleName() + (m != null ? ": " + m : "");
                } finally { if (c != null) c.disconnect(); }
                if (err != null) netErr.put(id, err); else netTxt.put(id, txt);
                js("window.Update && Update._netDone(" + jsQuote(id) + ")");
            } }).start();
        }

        @android.webkit.JavascriptInterface
        public String text(String id) { return netTxt.get(id); }

        @android.webkit.JavascriptInterface
        public String error(String id) { return netErr.get(id); }

        @android.webkit.JavascriptInterface
        public void done(String id) { netTxt.remove(id); netErr.remove(id); netStop.remove(id); }

        @android.webkit.JavascriptInterface
        public void cancel(String id) { netStop.put(id, Boolean.TRUE); }

        @android.webkit.JavascriptInterface
        public void open(String url) {
            try {
                android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
                i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) { }
        }

        // Android 8+: установка из стороннего источника разрешается отдельно для каждого приложения
        @android.webkit.JavascriptInterface
        public boolean canInstall() {
            try { return Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls(); }
            catch (Exception e) { return true; }
        }

        @android.webkit.JavascriptInterface
        public void askInstall() {
            try {
                android.content.Intent i = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    android.net.Uri.parse("package:" + getPackageName()));
                i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) { }
        }

        @android.webkit.JavascriptInterface
        public void download(final String id, final String url, final String sha256, final int expect) {
            netStop.remove(id);
            new Thread(new Runnable() { public void run() {
                java.net.HttpURLConnection c = null; String err = null;
                java.io.File out = ApkProvider.fileFor(MainActivity.this);
                java.io.FileOutputStream fo = null;
                try {
                    if (out.exists()) out.delete();
                    c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setInstanceFollowRedirects(true);
                    c.setConnectTimeout(15000); c.setReadTimeout(60000);
                    c.setRequestProperty("Accept", "application/octet-stream");
                    c.setRequestProperty("User-Agent", "Grimhold3D");
                    int code = c.getResponseCode();
                    if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        c = (java.net.HttpURLConnection) new java.net.URL(loc).openConnection();
                        c.setConnectTimeout(15000); c.setReadTimeout(60000);
                        c.setRequestProperty("User-Agent", "Grimhold3D");
                        code = c.getResponseCode();
                    }
                    if (code != 200) throw new Exception("HTTP " + code);
                    final int total = c.getContentLength() > 0 ? c.getContentLength() : expect;
                    java.io.InputStream is = c.getInputStream();
                    fo = new java.io.FileOutputStream(out);
                    java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                    byte[] buf = new byte[32768]; int n; long got = 0, mark = 0;
                    while ((n = is.read(buf)) > 0) {
                        if (Boolean.TRUE.equals(netStop.get(id))) throw new Exception("отменено");
                        fo.write(buf, 0, n); md.update(buf, 0, n); got += n;
                        if (got - mark > 131072) {
                            mark = got;
                            js("window.Update && Update._dlProgress(" + jsQuote(id) + "," + got + "," + total + ")");
                        }
                    }
                    is.close(); fo.flush(); fo.close(); fo = null;
                    js("window.Update && Update._dlProgress(" + jsQuote(id) + "," + got + "," + total + ")");
                    if (got < 100000) throw new Exception("файл подозрительно мал");
                    if (sha256 != null && sha256.length() == 64) {
                        StringBuilder hex = new StringBuilder();
                        for (byte b : md.digest()) hex.append(String.format("%02x", b & 0xff));
                        if (!hex.toString().equalsIgnoreCase(sha256))
                            throw new Exception("контрольная сумма не совпала — файл повреждён или подменён");
                    }
                } catch (Exception e) {
                    String m = e.getMessage();
                    err = (m != null && m.length() > 0) ? m : e.getClass().getSimpleName();
                    try { if (fo != null) fo.close(); } catch (Exception e2) { }
                    try { if (out.exists()) out.delete(); } catch (Exception e2) { }
                } finally { if (c != null) c.disconnect(); }
                if (err != null) netErr.put(id, err);
                js("window.Update && Update._dlDone(" + jsQuote(id) + ")");
            } }).start();
        }

        @android.webkit.JavascriptInterface
        public void install(final String id) {
            runOnUiThread(new Runnable() { public void run() {
                try {
                    java.io.File f = ApkProvider.fileFor(MainActivity.this);
                    if (!f.exists()) { netErr.put(id, "файл не найден"); js("window.Update && Update._dlDone(" + jsQuote(id) + ")"); return; }
                    android.net.Uri u = ApkProvider.uriFor(MainActivity.this);
                    android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW);
                    i.setDataAndType(u, "application/vnd.android.package-archive");
                    i.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION | android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (Exception e) {
                    netErr.put(id, "установщик не открылся: " + e.getMessage());
                    js("window.Update && Update._dlDone(" + jsQuote(id) + ")");
                }
            } });
        }
    }

    private void hideBars() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){ try { return window.appBack ? window.appBack() : 'handled'; } catch(e) { return 'handled'; } })();", new android.webkit.ValueCallback<String>() {
            @Override public void onReceiveValue(String value) { if (value != null && value.contains("exit")) finish(); }
        });
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (Build.VERSION.SDK_INT >= 29) {
            web.post(new Runnable() { @Override public void run() {
                int w = web.getWidth(), h = web.getHeight();
                java.util.List<android.graphics.Rect> rects = new java.util.ArrayList<android.graphics.Rect>();
                // Android учитывает только ~200 dp снизу — исключаем зону кнопок (правый низ) и джойстика (левый низ)
                int dp = (int) (200 * getResources().getDisplayMetrics().density);
                rects.add(new android.graphics.Rect(0, h - dp, 220, h));
                rects.add(new android.graphics.Rect(w - 360, h - dp, w, h));
                web.setSystemGestureExclusionRects(rects);
            } });
        }
    }

    @Override
    protected void onPause() { super.onPause(); web.evaluateJavascript("if (typeof Save!=='undefined' && typeof G!=='undefined' && G) Save.auto();", null); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); hideBars(); }
}
