package com.grimhold.game;

// Минимальный провайдер файлов: с targetSdk 24+ установщику нельзя отдать file://,
// а androidx.FileProvider в сборке без Gradle недоступен. Отдаём один файл — скачанный APK.
public class ApkProvider extends android.content.ContentProvider {
    public static final String AUTHORITY = "com.grimhold.game3d.apk";
    public static final String NAME = "update.apk";

    public static android.net.Uri uriFor(android.content.Context ctx) {
        return android.net.Uri.parse("content://" + AUTHORITY + "/" + NAME);
    }

    public static java.io.File fileFor(android.content.Context ctx) {
        return new java.io.File(ctx.getCacheDir(), NAME);
    }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(android.net.Uri uri) { return "application/vnd.android.package-archive"; }

    @Override
    public android.os.ParcelFileDescriptor openFile(android.net.Uri uri, String mode) throws java.io.FileNotFoundException {
        java.io.File f = fileFor(getContext());
        if (!f.exists()) throw new java.io.FileNotFoundException(NAME);
        return android.os.ParcelFileDescriptor.open(f, android.os.ParcelFileDescriptor.MODE_READ_ONLY);
    }

    // Установщик спрашивает имя и размер — без этого показывает пустое окно
    @Override
    public android.database.Cursor query(android.net.Uri uri, String[] proj, String sel, String[] args, String sort) {
        java.io.File f = fileFor(getContext());
        String[] cols = proj != null ? proj : new String[] { android.provider.OpenableColumns.DISPLAY_NAME, android.provider.OpenableColumns.SIZE };
        Object[] vals = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (android.provider.OpenableColumns.DISPLAY_NAME.equals(cols[i])) vals[i] = NAME;
            else if (android.provider.OpenableColumns.SIZE.equals(cols[i])) vals[i] = Long.valueOf(f.length());
            else vals[i] = null;
        }
        android.database.MatrixCursor c = new android.database.MatrixCursor(cols, 1);
        c.addRow(vals);
        return c;
    }

    @Override public android.net.Uri insert(android.net.Uri uri, android.content.ContentValues v) { throw new UnsupportedOperationException(); }
    @Override public int delete(android.net.Uri uri, String sel, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(android.net.Uri uri, android.content.ContentValues v, String sel, String[] args) { throw new UnsupportedOperationException(); }
}
