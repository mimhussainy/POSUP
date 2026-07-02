package com.foodup.posup

import android.hardware.display.DisplayManager
import android.view.Display
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CustomerDisplayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var presentation: CustomerDisplayPresentation? = null

    override fun getName() = "CustomerDisplayModule"

    private fun findSecondaryDisplay(): Display? {
        val displayManager = reactApplicationContext
            .getSystemService(android.content.Context.DISPLAY_SERVICE) as DisplayManager

        for (d in displayManager.displays) {
            if ((d.flags and Display.FLAG_SECURE) != 0 &&
                (d.flags and Display.FLAG_SUPPORTS_PROTECTED_BUFFERS) != 0 &&
                (d.flags and Display.FLAG_PRESENTATION) != 0
            ) {
                return d
            }
        }

        // Fallback: some devices don't set all three flags identically --
        // if there's any non-default display at all, use the first one.
        return displayManager.displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY }
    }

    @ReactMethod
    fun show(promise: Promise) {
        try {
            val activity = currentActivity
            val app = activity?.application as? ReactApplication
            val reactInstanceManager = app?.reactNativeHost?.reactInstanceManager
            val display = findSecondaryDisplay()

            if (activity == null || reactInstanceManager == null || display == null) {
                promise.resolve(false)
                return
            }

            presentation?.dismiss()
            presentation = CustomerDisplayPresentation(activity, display, reactInstanceManager)
            presentation?.show()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CUSTOMER_DISPLAY_ERROR", e)
        }
    }

    @ReactMethod
    fun hide(promise: Promise) {
        presentation?.dismiss()
        presentation = null
        promise.resolve(true)
    }

    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(findSecondaryDisplay() != null)
    }
}