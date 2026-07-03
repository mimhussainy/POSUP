package com.foodup.posup

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
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

/**
 * Generic printer executor for the Sunmi D3 built-in printer.
 *
 * This module intentionally contains NO receipt layout logic — no concept of
 * "orders", "restaurants", "totals", etc. It only executes a generic list of
 * print instructions built in JS (see buildSunmiInstructions in lib/printer.ts).
 *
 * Goal: receipt design changes (spacing, sizes, bold, order of sections,
 * column widths, logo on/off, logo width, footer text) ship via `eas update`
 * only. A native rebuild is only needed when a genuinely new instruction
 * TYPE is introduced (e.g. QR codes, barcodes) — not for styling changes.
 *
 * Supported instruction shapes:
 *   { type: "text",    content, bold?, size?, align? }
 *   { type: "columns", content: string[], widths: number[], aligns?: string[], bold?, size? }
 *   { type: "divider", weight? }
 *   { type: "blank",   size?, align? }
 *   { type: "bitmap",  base64, width?, align?, fallbackText?, fallbackBold?, fallbackSize? }
 *
 * "bitmap" always flattens onto a white background before printing — this is
 * the one piece of image handling that has to stay native (needs android.graphics
 * Bitmap/Canvas). Whether to send a bitmap at all, and how wide, is a JS decision.
 */
class SunmiPrinterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var cachedPrinter: PrinterSdk.Printer? = null

    override fun getName() = "SunmiPrinterModule"

    private fun textStyle(bold: Boolean = false, size: Int? = null, align: Align = Align.LEFT): TextStyle {
        var style = TextStyle.getStyle().setAlign(align).enableBold(bold)
        if (size != null) style = style.setTextSize(size)
        return style
    }

    private fun parseAlign(value: String?): Align {
        return when (value?.lowercase()) {
            "center" -> Align.CENTER
            "right" -> Align.RIGHT
            else -> Align.LEFT
        }
    }

    // Transparent PNGs decode with an alpha channel, and BINARIZATION reads
    // transparent pixels as black rather than compositing them onto white —
    // that's what caused the solid black rectangle. Flatten onto an opaque
    // white canvas first so transparent areas print as white paper.
    private fun flattenBitmapOnWhite(src: Bitmap): Bitmap {
        val output = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        canvas.drawColor(Color.WHITE)
        canvas.drawBitmap(src, 0f, 0f, null)
        return output
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

    private fun printBitmapInstruction(api: LineApi, instr: JSONObject) {
    val base64 = instr.optString("base64", "")
    val width = if (instr.has("width")) instr.optInt("width") else -1
    val height = if (instr.has("height")) instr.optInt("height") else -1
    val preserveAspect = instr.optBoolean("preserveAspect", true)
    val align = parseAlign(instr.optString("align", "center"))

    var printed = false

    if (base64.isNotEmpty()) {
        try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)

            if (bitmap != null) {
                val flattened = flattenBitmapOnWhite(bitmap)

                val resized = when {
                    width > 0 && height > 0 && preserveAspect -> {
                        val scale = minOf(
                            width.toFloat() / flattened.width.toFloat(),
                            height.toFloat() / flattened.height.toFloat()
                        )

                        val targetWidth = (flattened.width * scale).toInt().coerceAtLeast(1)
                        val targetHeight = (flattened.height * scale).toInt().coerceAtLeast(1)

                        Bitmap.createScaledBitmap(flattened, targetWidth, targetHeight, true)
                    }

                    width > 0 && height > 0 -> {
                        Bitmap.createScaledBitmap(flattened, width, height, true)
                    }

                    width > 0 -> {
                        val targetHeight = (
                            flattened.height.toFloat() / flattened.width.toFloat() * width
                        ).toInt().coerceAtLeast(1)

                        Bitmap.createScaledBitmap(flattened, width, targetHeight, true)
                    }

                    height > 0 -> {
                        val targetWidth = (
                            flattened.width.toFloat() / flattened.height.toFloat() * height
                        ).toInt().coerceAtLeast(1)

                        Bitmap.createScaledBitmap(flattened, targetWidth, height, true)
                    }

                    else -> flattened
                }

                api.printBitmap(
                    resized,
                    BitmapStyle.getStyle()
                        .setAlign(align)
                        .setAlgorithm(ImageAlgorithm.BINARIZATION)
                )

                printed = true
            }
        } catch (e: Exception) {
            // falls through to fallbackText below
        }
    }

    if (!printed) {
        val fallbackText = instr.optString("fallbackText", "")
        if (fallbackText.isNotEmpty()) {
            api.printText(
                fallbackText,
                textStyle(
                    bold = instr.optBoolean("fallbackBold", true),
                    size = if (instr.has("fallbackSize")) instr.optInt("fallbackSize") else null,
                    align = align
                )
            )
        }
    }
}

    private fun printColumnsInstruction(api: LineApi, instr: JSONObject) {
        val contentArr = instr.optJSONArray("content") ?: JSONArray()
        val widthsArr = instr.optJSONArray("widths") ?: JSONArray()
        val alignsArr = instr.optJSONArray("aligns")
        val bold = instr.optBoolean("bold", false)
        val size = if (instr.has("size")) instr.optInt("size") else null

        val count = contentArr.length()
        val content = Array(count) { contentArr.optString(it, "") }
        val widths = IntArray(count) { widthsArr.optInt(it, 1) }
        val styles = Array(count) { i ->
            val colAlign = if (alignsArr != null && i < alignsArr.length()) {
                parseAlign(alignsArr.optString(i, "left"))
            } else if (i == count - 1) {
                Align.RIGHT
            } else {
                Align.LEFT
            }
            textStyle(bold = bold, size = size, align = colAlign)
        }

        api.printTexts(content, widths, styles)
    }

    private fun executeInstructions(api: LineApi, instructions: JSONArray) {
        var currentAlign: Align? = null

        fun ensureAlign(align: Align) {
            if (currentAlign != align) {
                api.initLine(BaseStyle.getStyle().setAlign(align))
                currentAlign = align
            }
        }

        for (i in 0 until instructions.length()) {
            val instr = instructions.getJSONObject(i)
            when (instr.optString("type")) {
                "text" -> {
                    val align = parseAlign(instr.optString("align", "left"))
                    ensureAlign(align)
                    api.printText(
                        instr.optString("content", ""),
                        textStyle(
                            bold = instr.optBoolean("bold", false),
                            size = if (instr.has("size")) instr.optInt("size") else null,
                            align = align
                        )
                    )
                }
                "columns" -> {
                    // Column rows always sit in a LEFT line context; per-column
                    // alignment (label vs. value) is handled by each column's own style.
                    ensureAlign(Align.LEFT)
                    printColumnsInstruction(api, instr)
                }
                "divider" -> {
                    ensureAlign(Align.LEFT)
                    api.printDividingLine(DividingLine.SOLID, instr.optInt("weight", 1))
                }
                "blank" -> {
                    val align = parseAlign(instr.optString("align", "left"))
                    val size = instr.optInt("size", 10)
                    val lines = instr.optInt("lines", 1).coerceAtLeast(1)

                    ensureAlign(align)

                    repeat(lines) {
                        api.printText(" ", textStyle(size = size, align = align))
                    }
                }
                "feed" -> {
                    val align = parseAlign(instr.optString("align", "left"))
                    val size = instr.optInt("size", 24)
                    val lines = instr.optInt("lines", 4).coerceAtLeast(1)

                    ensureAlign(align)

                    repeat(lines) {
                        api.printText(" ", textStyle(size = size, align = align))
                    }
                }
                "bitmap" -> {
                    val align = parseAlign(instr.optString("align", "center"))
                    ensureAlign(align)
                    printBitmapInstruction(api, instr)
                }
            }
        }

        api.autoOut()
    }

    @ReactMethod
    fun printInstructions(instructionsJson: String, promise: Promise) {
        try {
            val instructions = JSONArray(instructionsJson)
            val settled = AtomicBoolean(false)

            getPrinterAsync { printer ->
                if (!settled.compareAndSet(false, true)) return@getPrinterAsync

                if (printer == null) {
                    promise.reject("SUNMI_PRINTER_NOT_FOUND", "PrinterSdk.getPrinter() timed out or returned no default printer")
                    return@getPrinterAsync
                }

                try {
                    executeInstructions(printer.lineApi(), instructions)
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