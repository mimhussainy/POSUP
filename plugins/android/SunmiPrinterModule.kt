package com.foodup.posup

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.graphics.BitmapFactory
import android.os.IBinder
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import woyou.aidlservice.jiuiv5.ICallback
import woyou.aidlservice.jiuiv5.IWoyouService

class SunmiPrinterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var woyouService: IWoyouService? = null
    private var pendingPromise: Promise? = null
    private var pendingOrder: JSONObject? = null
    private var pendingRestaurant: JSONObject? = null

    override fun getName() = "SunmiPrinterModule"

    private val quietCallback = object : ICallback.Stub() {
        override fun onRunResult(isSuccess: Boolean) {}
        override fun onReturnString(result: String?) {}
        override fun onRaiseException(code: Int, msg: String?) {}
        override fun onPrintResult(code: Int, msg: String?) {}
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            woyouService = IWoyouService.Stub.asInterface(service)

            val order = pendingOrder
            val restaurant = pendingRestaurant
            val promise = pendingPromise

            if (order != null && restaurant != null && promise != null) {
                try {
                    doPrint(order, restaurant)
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("SUNMI_PRINT_ERROR", e)
                }
            }

            pendingOrder = null
            pendingRestaurant = null
            pendingPromise = null
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            woyouService = null
        }
    }

    private fun col(text: String, width: Int, align: Int) = Triple(text, width, align)

    private fun printColumns(cols: List<Triple<String, Int, Int>>) {
        val texts = cols.map { it.first }.toTypedArray()
        val widths = cols.map { it.second }.toIntArray()
        val aligns = cols.map { it.third }.toIntArray()
        woyouService?.printColumnsText(texts, widths, aligns, quietCallback)
    }

    private fun formatCHF(v: Double): String {
        return "CHF " + String.format("%.2f", v)
    }

    private fun doPrint(order: JSONObject, restaurant: JSONObject) {
        val svc = woyouService ?: return

        svc.printerInit(quietCallback)

        val restaurantName = restaurant.optString("name", "")
        val logoBase64 = restaurant.optString("logoBase64", "")

        svc.setAlignment(1, quietCallback)

        var logoPrinted = false
        if (logoBase64.isNotEmpty()) {
            try {
                val bytes = Base64.decode(logoBase64, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                if (bitmap != null) {
                    svc.printBitmap(bitmap, quietCallback)
                    logoPrinted = true
                }
            } catch (e: Exception) {
            }
        }

        if (!logoPrinted) {
            svc.setFontSize(32f, quietCallback)
            svc.printText(restaurantName.uppercase() + "\n", quietCallback)
        }

        svc.setFontSize(24f, quietCallback)
        svc.printText(order.optString("order_number", "") + "\n", quietCallback)

        svc.setFontSize(20f, quietCallback)
        svc.printText(order.optString("dateTimeLabel", "") + "\n", quietCallback)

        val table = order.optString("table", "")
        if (table.isNotEmpty() && table != "Walk-in" && table != "Not specified") {
            svc.printText(order.optString("tableLabel", "") + "\n", quietCallback)
        }

        svc.setAlignment(0, quietCallback)
        svc.printText("------------------------------------------\n", quietCallback)

        val items = order.optJSONArray("items") ?: JSONArray()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val qty = item.optString("quantity", "1")
            var name = item.optString("name", "")
            val variation = item.optString("variation", "")
            if (variation.isNotEmpty()) name = "$name ($variation)"
            val total = item.optDouble("total", 0.0)

            printColumns(
                listOf(
                    col("${qty}x", 4, 0),
                    col(name, 26, 0),
                    col(formatCHF(total), 12, 2)
                )
            )

            val addons = item.optJSONArray("addons") ?: JSONArray()
            for (j in 0 until addons.length()) {
                val addon = addons.getJSONObject(j)
                svc.printText("   + " + addon.optString("label", "") + "\n", quietCallback)
            }
        }

        val discount = order.optDouble("discount", 0.0)
        if (discount > 0) {
            printColumns(listOf(col(order.optString("subtotalLabel", "Subtotal"), 30, 0), col(formatCHF(order.optDouble("subtotal", 0.0)), 12, 2)))
            printColumns(listOf(col(order.optString("discountLabel", "Discount"), 30, 0), col("-" + formatCHF(discount), 12, 2)))
        }

        printColumns(listOf(col(order.optString("totalLabel", "TOTAL"), 30, 0), col(formatCHF(order.optDouble("total", 0.0)), 12, 2)))

        val paymentValue = order.optString("paymentValueLabel", "")
        printColumns(listOf(col(order.optString("paymentLabel", "Payment"), 30, 0), col(paymentValue, 12, 2)))

        val note = order.optString("note", "")
        if (note.isNotEmpty()) {
            svc.printText(order.optString("noteLabel", "Note") + ": " + note + "\n", quietCallback)
        }

        svc.printText("------------------------------------------\n", quietCallback)
        svc.setAlignment(1, quietCallback)
        svc.printText(order.optString("thankLabel", "") + "\n", quietCallback)
        svc.printText("------------------------------------------\n", quietCallback)
        svc.setFontSize(16f, quietCallback)
        svc.printText("Powered by: FoodUp.ch\n", quietCallback)

        svc.lineWrap(5, quietCallback)
    }

    @ReactMethod
    fun printSunmiReceipt(orderJson: String, restaurantJson: String, promise: Promise) {
        try {
            val order = JSONObject(orderJson)
            val restaurant = JSONObject(restaurantJson)

            if (woyouService != null) {
                doPrint(order, restaurant)
                promise.resolve(true)
                return
            }

            pendingOrder = order
            pendingRestaurant = restaurant
            pendingPromise = promise

            val intent = Intent()
            intent.setPackage("woyou.aidlservice.jiuiv5")
            intent.action = "woyou.aidlservice.jiuiv5.IWoyouService"

            val bound = reactApplicationContext.bindService(intent, connection, Context.BIND_AUTO_CREATE)

            if (!bound) {
                pendingOrder = null
                pendingRestaurant = null
                pendingPromise = null
                promise.reject("SUNMI_SERVICE_NOT_FOUND", "bindService returned false -- Sunmi print service (woyou.aidlservice.jiuiv5) not found on this device")
                return
            }

            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                if (pendingPromise === promise) {
                    pendingOrder = null
                    pendingRestaurant = null
                    pendingPromise = null
                    promise.reject("SUNMI_SERVICE_TIMEOUT", "Timed out waiting for Sunmi print service to connect")
                }
            }, 5000)
        } catch (e: Exception) {
            promise.reject("SUNMI_PRINT_ERROR", e)
        }
    }
}