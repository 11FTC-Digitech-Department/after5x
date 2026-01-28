# Add project specific ProGuard rules here.
# For more details, see http://developer.android.com/guide/developing/tools/proguard.html

# Keep line numbers for better crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ============================================
# Capacitor Core Rules
# ============================================

# Keep Capacitor plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# Keep plugin annotations
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
    @com.getcapacitor.PluginMethod public <methods>;
}

# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ============================================
# WebView Rules
# ============================================

-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
    public void *(android.webkit.WebView, java.lang.String);
}

# ============================================
# Google Maps Plugin
# ============================================

-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.maps.** { *; }

# ============================================
# Biometric Plugin
# ============================================

-keep class com.epicshaggy.biometric.** { *; }

# ============================================
# AndroidX and Support Libraries
# ============================================

-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ============================================
# Kotlin
# ============================================

-dontwarn kotlin.**
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }

# ============================================
# OkHttp (used by some Capacitor plugins)
# ============================================

-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ============================================
# Gson (if used for JSON parsing)
# ============================================

-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# ============================================
# Prevent stripping of native methods
# ============================================

-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================
# Enums
# ============================================

-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ============================================
# Parcelables
# ============================================

-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ============================================
# R8 Full Mode Compatibility
# ============================================

-keepattributes InnerClasses
-keepattributes EnclosingMethod
