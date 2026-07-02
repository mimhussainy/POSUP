package woyou.aidlservice.jiuiv5;

import android.graphics.Bitmap;
import woyou.aidlservice.jiuiv5.ICallback;

interface IWoyouService {
    String getPrinterVersion();
    String getPrinterSerialNo();
    String getPrinterModal();
    String getServiceVersion();
    void printerInit(ICallback callback);
    void printerSelfChecking(ICallback callback);
    void setAlignment(int alignment, ICallback callback);
    void setFontName(String typeface, ICallback callback);
    void setFontSize(float fontsize, ICallback callback);
    void printText(String text, ICallback callback);
    void printTextWithFont(String text, String typeface, float fontsize, ICallback callback);
    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, ICallback callback);
    void printColumnsString(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, ICallback callback);
    void printBitmap(in Bitmap bitmap, ICallback callback);
    void lineWrap(int n, ICallback callback);
    void sendRAWData(in byte[] data, ICallback callback);
}