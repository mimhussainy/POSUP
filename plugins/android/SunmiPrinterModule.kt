package com.foodup.posup

import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.sunmi.printerx.PrinterSdk
import com.sunmi.printerx.SdkException
import com.sunmi.printerx.api.LineApi
import com.sunmi.printerx.enums.Align
import com.sunmi.printerx.enums.DividingLine
import com.sunmi.printerx.enums.ImageAlgorithm
import com.sunmi.printerx.style.BaseStyle
import com.sunmi.printerx.style.BitmapStyle
import com.sunmi.printerx.style.TextStyle
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

class SunmiPrinterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var cachedPrinter: PrinterSdk.Printer? = null

    override fun getName() = "SunmiPrinterModule"

    private fun formatCHF(v: Double): String {
        return "CHF " + String.format("%.2f", v)
    }

    private fun textStyle(bold: Boolean = false, size: Int? = null, align: Align = Align.LEFT): TextStyle {
        var style = TextStyle.getStyle().setAlign(align).enableBold(bold)
        if (size != null) style = style.setTextSize(size)
        return style
    }

    private fun getPrinterAsync(onReady: (PrinterSdk.Printer?) -> Unit) {
        val existing = cachedPrinter
        if (existing != null) {
            onReady(existing)
            return
        }

        val delivered = AtomicBoolean(false)
        val timeoutHandler = Handler(Looper.getMainLooper())
        val timeoutRunnable = Runnable {
            if (delivered.compareAndSet(false, true)) {
                onReady(null)
            }
        }
        timeoutHandler.postDelayed(timeoutRunnable, 5000)

        try {
            PrinterSdk.getInstance().getPrinter(
                reactApplicationContext,
                object : PrinterSdk.PrinterListen {
                    override fun onDefPrinter(printer: PrinterSdk.Printer) {
                        if (delivered.compareAndSet(false, true)) {
                            timeoutHandler.removeCallbacks(timeoutRunnable)
                            cachedPrinter = printer
                            onReady(printer)
                        }
                    }

                    override fun onPrinters(printers: List<PrinterSdk.Printer>) {}
                }
            )
        } catch (e: SdkException) {
            if (delivered.compareAndSet(false, true)) {
                timeoutHandler.removeCallbacks(timeoutRunnable)
                onReady(null)
            }
        }
    }

    private fun doPrint(printer: PrinterSdk.Printer, order: JSONObject, restaurant: JSONObject) {
        val api: LineApi = printer.lineApi()

        val restaurantName = restaurant.optString("name", "")
        val logoBase64 = restaurant.optString("logoBase64", "")

        api.initLine(BaseStyle.getStyle().setAlign(Align.CENTER))

        var logoPrinted = false
        if (logoBase64.isNotEmpty()) {
            try {
                val bytes = Base64.decode(logoBase64, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                if (bitmap != null) {
                    api.printBitmap(
                        bitmap,
                        BitmapStyle.getStyle()
                            .setAlign(Align.CENTER)
                            .setAlgorithm(ImageAlgorithm.BINARIZATION)
                            .setWidth(384)
                    )
                    logoPrinted = true
                }
            } catch (e: Exception) {
            }
        }

        if (!logoPrinted) {
            api.printText(restaurantName.uppercase(), textStyle(bold = true, size = 32, align = Align.CENTER))
        }

        api.printText(order.optString("order_number", ""), textStyle(bold = true, size = 24, align = Align.CENTER))
        api.printText(order.optString("dateTimeLabel", ""), textStyle(size = 20, align = Align.CENTER))

        val table = order.optString("table", "")
        if (table.isNotEmpty() && table != "Walk-in" && table != "Not specified") {
            api.printText(order.optString("tableLabel", ""), textStyle(size = 20, align = Align.CENTER))
        }

        api.initLine(BaseStyle.getStyle().setAlign(Align.LEFT))
        api.printDividingLine(DividingLine.SOLID, 1)

        val items = order.optJSONArray("items") ?: JSONArray()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val qty = item.optString("quantity", "1")
            var name = item.optString("name", "")
            val variation = item.optString("variation", "")
            if (variation.isNotEmpty()) name = "$name ($variation)"
            val total = item.optDouble("total", 0.0)

            api.printTexts(
                arrayOf("${qty}x", name, formatCHF(total)),
                intArrayOf(1, 4, 2),
                arrayOf(
                    textStyle(bold = true, align = Align.LEFT),
                    textStyle(bold = true, align = Align.LEFT),
                    textStyle(bold = true, align = Align.RIGHT)
                )
            )

            val addons = item.optJSONArray("addons") ?: JSONArray()
            for (j in 0 until addons.length()) {
                val addon = addons.getJSONObject(j)
                api.printText("   + " + addon.optString("label", ""), textStyle(size = 18, align = Align.LEFT))
            }
        }

        val discount = order.optDouble("discount", 0.0)
        if (discount > 0) {
            api.printTexts(
                arrayOf(order.optString("subtotalLabel", "Subtotal"), formatCHF(order.optDouble("subtotal", 0.0))),
                intArrayOf(3, 1),
                arrayOf(textStyle(align = Align.LEFT), textStyle(align = Align.RIGHT))
            )
            api.printTexts(
                arrayOf(order.optString("discountLabel", "Discount"), "-" + formatCHF(discount)),
                intArrayOf(3, 1),
                arrayOf(textStyle(bold = true, align = Align.LEFT), textStyle(bold = true, align = Align.RIGHT))
            )
        }

        api.printTexts(
            arrayOf(order.optString("totalLabel", "TOTAL"), formatCHF(order.optDouble("total", 0.0))),
            intArrayOf(3, 1),
            arrayOf(
                textStyle(bold = true, size = 26, align = Align.LEFT),
                textStyle(bold = true, size = 26, align = Align.RIGHT)
            )
        )

        val paymentValue = order.optString("paymentValueLabel", "")
        api.printTexts(
            arrayOf(order.optString("paymentLabel", "Payment"), paymentValue),
            intArrayOf(3, 1),
            arrayOf(textStyle(bold = true, align = Align.LEFT), textStyle(bold = true, align = Align.RIGHT))
        )

        val note = order.optString("note", "")
        if (note.isNotEmpty()) {
            api.printText(order.optString("noteLabel", "Note") + ": " + note, textStyle(size = 18, align = Align.LEFT))
        }

        api.printDividingLine(DividingLine.SOLID, 1)
        api.initLine(BaseStyle.getStyle().setAlign(Align.CENTER))
        api.printText(order.optString("thankLabel", ""), textStyle(size = 20, align = Align.CENTER))
        api.printDividingLine(DividingLine.SOLID, 1)
        api.printText("Powered by: FoodUp.ch", textStyle(size = 16, align = Align.CENTER))

        api.autoOut()
    }

    @ReactMethod
    fun printSunmiReceipt(orderJson: String, restaurantJson: String, promise: Promise) {
        try {
            val order = JSONObject(orderJson)
            val restaurant = JSONObject(restaurantJson)
            val settled = AtomicBoolean(false)

            getPrinterAsync { printer ->
                if (!settled.compareAndSet(false, true)) return@getPrinterAsync

                if (printer == null) {
                    promise.reject("SUNMI_PRINTER_NOT_FOUND", "PrinterSdk.getPrinter() timed out or returned no default printer")
                    return@getPrinterAsync
                }

                try {
                    doPrint(printer, order, restaurant)
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("SUNMI_PRINT_ERROR", e)
                }
            }
        } catch (e: Exception) {
            promise.reject("SUNMI_PRINT_ERROR", e)
        }
    }
}