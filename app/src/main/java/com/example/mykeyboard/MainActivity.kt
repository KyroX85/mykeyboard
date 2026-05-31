package com.example.mykeyboard

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin

// ===================== COLORS =====================

private val BgDeep        = Color(0xFF060B14)
private val BgCard        = Color(0xFF0F1923)
private val BgCardBorder  = Color(0xFF1A2535)
private val AccentPurple  = Color(0xFF7B5CF0)
private val AccentBlue    = Color(0xFF4A9EFF)
private val AccentCyan    = Color(0xFF00D4FF)
private val AccentGreen   = Color(0xFF00E87A)
private val AccentTeal    = Color(0xFF00FFD1)
private val TextPrimary   = Color(0xFFFFFFFF)
private val TextSecondary = Color(0xFF8A9BB0)
private val TextMuted     = Color(0xFF4A5568)

// ===================== MAIN ACTIVITY =====================

class MainActivity : ComponentActivity() {

    companion object {
        const val EXTRA_REQUEST_MIC_PERMISSION = "com.example.mykeyboard.REQUEST_MIC_PERMISSION"
        private const val REQUEST_RECORD_AUDIO_PERMISSION = 4102
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AppScreen() }
        if (intent.getBooleanExtra(EXTRA_REQUEST_MIC_PERMISSION, false)) {
            requestMicrophonePermissionIfNeeded()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_REQUEST_MIC_PERMISSION, false)) {
            requestMicrophonePermissionIfNeeded()
        }
    }

    override fun onResume() {
        super.onResume()
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        if (isKeyboardEnabled() && !isKeyboardSelected()) {
            window.decorView.postDelayed({ imm.showInputMethodPicker() }, 300)
        }
    }

    private fun isKeyboardEnabled(): Boolean {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        return imm.enabledInputMethodList.any { it.packageName == packageName }
    }

    private fun isKeyboardSelected(): Boolean {
        val current = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
        return current?.contains(packageName) == true
    }

    private fun requestMicrophonePermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) return
        requestPermissions(arrayOf(android.Manifest.permission.RECORD_AUDIO), REQUEST_RECORD_AUDIO_PERMISSION)
    }
}

// ===================== APP SCREEN =====================

@Composable
fun AppScreen() {
    val context = LocalContext.current
    var enabled     by remember { mutableStateOf(false) }
    var selected    by remember { mutableStateOf(false) }
    var show        by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        enabled  = isKeyboardEnabledStatic(context)
        selected = isKeyboardSelectedStatic(context)
        show     = true
    }

    Box(modifier = Modifier.fillMaxSize().background(BgDeep)) {

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 72.dp)
                .verticalScroll(rememberScrollState())
        ) {
            HeroSection(show = show)

            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                AnimatedVisibility(visible = show,
                    enter = fadeIn(tween(400, 200)) + slideInVertically(tween(400, 200)) { it / 2 }
                ) { StatusCard(enabled = enabled, selected = selected) }

                AnimatedVisibility(visible = show,
                    enter = fadeIn(tween(400, 350)) + slideInVertically(tween(400, 350)) { it / 2 }
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        FeatureCard(":-)", "Emojis",   "24+ Emojis",   AccentPurple, Modifier.weight(1f))
                        FeatureCard("123", "Numbers",  "Smart Layout", AccentBlue,   Modifier.weight(1f))
                        FeatureCard("!@#", "Symbols",  "Quick Access", AccentCyan,   Modifier.weight(1f))
                    }
                }

                AnimatedVisibility(visible = show,
                    enter = fadeIn(tween(400, 500)) + slideInVertically(tween(400, 500)) { it / 2 }
                ) {
                    DefaultKeyboardButton(enabled = enabled) {
                        if (!enabled) {
                            context.startActivity(
                                Intent(Settings.ACTION_INPUT_METHOD_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            )
                        } else {
                            val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                            imm.showInputMethodPicker()
                        }
                    }
                }

                AnimatedVisibility(visible = show,
                    enter = fadeIn(tween(400, 600)) + slideInVertically(tween(400, 600)) { it / 2 }
                ) { QuickSetupSection(enabled = enabled, selected = selected) }

                AnimatedVisibility(visible = show,
                    enter = fadeIn(tween(400, 750)) + slideInVertically(tween(400, 750)) { it / 2 }
                ) { MissionProgressCard() }

                Spacer(Modifier.height(12.dp))
            }
        }

        BottomNavBar(
            selectedTab    = selectedTab,
            onTabSelected  = { selectedTab = it },
            modifier       = Modifier.align(Alignment.BottomCenter)
        )
    }
}

// ===================== HERO SECTION =====================

@Composable
fun HeroSection(show: Boolean) {
    val ringAngle = 18f
    val glowAlpha = 0.72f
    val logoTilt = 0f
    val logoScale = 1f

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(250.dp)
            .background(Brush.verticalGradient(listOf(Color(0xFF0D1B3E), Color(0xFF060B14))))
    ) {
        // Static ambient accents keep setup light on GPU.
        Box(
            modifier = Modifier.size(200.dp).align(Alignment.CenterEnd)
                .offset(x = 40.dp, y = (-20).dp)
                .background(
                    Brush.radialGradient(listOf(
                        AccentPurple.copy(alpha = 0.16f),
                        AccentBlue.copy(alpha = 0.18f),
                        Color.Transparent
                    )), CircleShape
                )
        )
        Box(
            modifier = Modifier.size(120.dp).align(Alignment.TopStart)
                .offset(x = (-20).dp, y = 10.dp)
                .background(
                    Brush.radialGradient(listOf(AccentTeal.copy(alpha = 0.10f), Color.Transparent)),
                    CircleShape
                )
        )

        // Title
        AnimatedVisibility(
            visible = show,
            enter   = fadeIn(tween(600)) + slideInHorizontally(tween(600)) { -it / 2 },
            modifier = Modifier.align(Alignment.CenterStart).padding(start = 22.dp)
        ) {
            Column {
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(color = TextPrimary,  fontWeight = FontWeight.ExtraBold, fontSize = 32.sp)) { append("ARITENIS ") }
                    withStyle(SpanStyle(color = AccentPurple, fontWeight = FontWeight.ExtraBold, fontSize = 32.sp)) { append("AI") }
                })
                Spacer(Modifier.height(8.dp))
                Text("Smart Keyboard",       color = TextSecondary, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                Text("for Indian Languages", color = TextSecondary, fontSize = 15.sp)
            }
        }

        // Logo
        AnimatedVisibility(
            visible  = show,
            enter    = fadeIn(tween(800)) + scaleIn(tween(800, easing = FastOutSlowInEasing)),
            modifier = Modifier.align(Alignment.CenterEnd).padding(end = 12.dp)
        ) {
            LogoWithOrbit(ringAngle = ringAngle, glowAlpha = glowAlpha, logoTilt = logoTilt, logoScale = logoScale)
        }
    }
}

// ===================== ORBITAL LOGO =====================

@Composable
fun LogoWithOrbit(ringAngle: Float, glowAlpha: Float, logoTilt: Float, logoScale: Float) {
    Box(modifier = Modifier.size(160.dp), contentAlignment = Alignment.Center) {

        // Outer ambient glow
        Box(
            modifier = Modifier.size(150.dp)
                .background(
                    Brush.radialGradient(listOf(
                        AccentPurple.copy(alpha = 0.45f * glowAlpha),
                        AccentBlue.copy(alpha = 0.2f),
                        Color.Transparent
                    )), CircleShape
                )
        )

        // Dark circle backing with gradient border
        Box(
            modifier = Modifier
                .size(120.dp)
                .background(
                    Brush.radialGradient(listOf(Color(0xFF1A1040), Color(0xFF0D0A2E))),
                    CircleShape
                )
                .border(
                    width = 1.5.dp,
                    brush = Brush.sweepGradient(listOf(AccentPurple, AccentBlue, AccentCyan, AccentTeal, AccentPurple)),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            // Logo with static tilt and scale to avoid setup-screen GPU churn.
            Image(
                painter            = painterResource(id = R.drawable.logo),
                contentDescription = "Aritenis AI Logo",
                contentScale       = ContentScale.Fit,
                modifier           = Modifier
                    .size(80.dp)
                    .rotate(logoTilt)
                    .scale(logoScale)
            )
        }

        // Inner teal glow behind logo
        Box(
            modifier = Modifier.size(100.dp)
                .background(
                    Brush.radialGradient(listOf(AccentTeal.copy(alpha = 0.22f * glowAlpha), Color.Transparent)),
                    CircleShape
                )
        )

        // Canvas: static orbital rings and dots.
        androidx.compose.foundation.Canvas(modifier = Modifier.size(160.dp)) {
            val cx = size.width / 2f
            val cy = size.height / 2f

            // Outer orbit
            val rx1 = size.width / 2f - 4f
            val ry1 = size.height / 5.5f
            drawOval(
                color   = AccentBlue.copy(alpha = 0.55f),
                topLeft = Offset(cx - rx1, cy - ry1),
                size    = Size(rx1 * 2, ry1 * 2),
                style   = Stroke(width = 1.5f)
            )

            // Inner orbit
            val rx2 = size.width / 2.4f
            val ry2 = size.height / 7f
            drawOval(
                color   = AccentCyan.copy(alpha = 0.3f),
                topLeft = Offset(cx - rx2, cy - ry2),
                size    = Size(rx2 * 2, ry2 * 2),
                style   = Stroke(width = 1f)
            )

            // Main orbiting dot + halo
            val rad1 = Math.toRadians(ringAngle.toDouble())
            val dx1  = (cx + rx1 * cos(rad1)).toFloat()
            val dy1  = (cy + ry1 * sin(rad1)).toFloat()
            drawCircle(color = AccentCyan.copy(alpha = 0.4f * glowAlpha), radius = 9f,   center = Offset(dx1, dy1))
            drawCircle(color = Color.White,                                radius = 4.5f, center = Offset(dx1, dy1))

            // Second dot (180 degree offset, inner orbit)
            val rad2 = Math.toRadians((ringAngle + 180.0))
            val dx2  = (cx + rx2 * cos(rad2)).toFloat()
            val dy2  = (cy + ry2 * sin(rad2)).toFloat()
            drawCircle(color = AccentTeal.copy(alpha = 0.85f), radius = 3f, center = Offset(dx2, dy2))
        }
    }
}

// ===================== STATUS CARD =====================

@Composable
fun StatusCard(enabled: Boolean, selected: Boolean) {
    val isActive  = enabled || selected
    val pulseAnim = rememberInfiniteTransition(label = "pulse")
    val dotScale  by pulseAnim.animateFloat(
        initialValue = 0.8f, targetValue = 1.3f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "dot"
    )

    Card(
        modifier  = Modifier.fillMaxWidth().border(1.dp, BgCardBorder, RoundedCornerShape(16.dp)),
        colors    = CardDefaults.cardColors(BgCard),
        shape     = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(0.dp)
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(54.dp)
                    .background(AccentGreen.copy(alpha = 0.15f), CircleShape)
                    .border(2.dp, AccentGreen, CircleShape),
                contentAlignment = Alignment.Center
            ) { Text("✓", color = AccentGreen, fontSize = 22.sp, fontWeight = FontWeight.Bold) }

            Spacer(Modifier.width(14.dp))

            Column(Modifier.weight(1f)) {
                Text("Keyboard Status", color = TextSecondary, fontSize = 12.sp)
                Spacer(Modifier.height(3.dp))
                Text(
                    if (isActive) "Enabled" else "Not Enabled",
                    color = if (isActive) AccentGreen else Color(0xFFFF6B6B),
                    fontWeight = FontWeight.Bold, fontSize = 16.sp
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    if (selected) "Active as default keyboard" else "Ready to be set as default",
                    color = TextMuted, fontSize = 11.sp
                )
            }

            Box(modifier = Modifier.size((8 * dotScale).dp).background(
                if (isActive) AccentGreen else Color(0xFFFF6B6B), CircleShape
            ))
        }
    }
}

// ===================== FEATURE CARD =====================

@Composable
fun FeatureCard(emoji: String, title: String, subtitle: String, accentColor: Color, modifier: Modifier = Modifier) {
    Card(
        modifier  = modifier.border(1.dp, BgCardBorder, RoundedCornerShape(14.dp)),
        colors    = CardDefaults.cardColors(BgCard),
        shape     = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(0.dp)
    ) {
        Column(
            modifier            = Modifier.padding(14.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier.size(48.dp)
                    .background(accentColor.copy(alpha = 0.12f), CircleShape)
                    .border(1.dp, accentColor.copy(alpha = 0.45f), CircleShape),
                contentAlignment = Alignment.Center
            ) { Text(emoji, fontSize = 20.sp) }
            Spacer(Modifier.height(10.dp))
            Text(title,    color = TextPrimary,   fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Spacer(Modifier.height(3.dp))
            Text(subtitle, color = TextSecondary, fontSize = 10.sp)
        }
    }
}

// ===================== CTA BUTTON =====================

@Composable
fun DefaultKeyboardButton(enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth().height(58.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFF5B3FD4), Color(0xFF7B5CF0), Color(0xFF4A9EFF))))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            Text("✦", color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp)
            Spacer(Modifier.width(10.dp))
            Text(
                if (enabled) "Set as Default Keyboard" else "Enable Keyboard",
                color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp
            )
            Spacer(Modifier.width(10.dp))
            Text("›", color = Color.White.copy(alpha = 0.8f), fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// ===================== QUICK SETUP =====================

@Composable
fun QuickSetupSection(enabled: Boolean, selected: Boolean) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Quick Setup", color = TextPrimary,   fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("3 Steps",     color = TextSecondary, fontSize = 12.sp)
        }
        Spacer(Modifier.height(10.dp))
        SetupStep("1", "Enable Keyboard", "Go to Settings & enable Aritenis AI",          enabled,  AccentGreen)
        Spacer(Modifier.height(8.dp))
        SetupStep("2", "Set as Default",  "Select Aritenis AI as your default keyboard",   selected, AccentPurple)
        Spacer(Modifier.height(8.dp))
        SetupStep("3", "Start Typing",    "Type naturally & help improve your experience", false,    AccentBlue)
    }
}

@Composable
fun SetupStep(number: String, title: String, subtitle: String, done: Boolean, accentColor: Color) {
    Card(
        modifier  = Modifier.fillMaxWidth().border(1.dp, if (done) accentColor.copy(0.3f) else BgCardBorder, RoundedCornerShape(14.dp)),
        colors    = CardDefaults.cardColors(if (done) accentColor.copy(0.06f) else BgCard),
        shape     = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(0.dp)
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(36.dp)
                    .background(if (done) accentColor.copy(0.15f) else BgCardBorder, CircleShape)
                    .border(1.5.dp, if (done) accentColor else TextMuted, CircleShape),
                contentAlignment = Alignment.Center
            ) { Text(number, color = if (done) accentColor else TextSecondary, fontWeight = FontWeight.Bold, fontSize = 14.sp) }

            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title,    color = TextPrimary,   fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(subtitle, color = TextSecondary, fontSize = 11.sp)
            }
            if (done) Text("✓", color = accentColor, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            else      Text("›", color = TextMuted,   fontSize = 20.sp)
        }
    }
}

// ===================== MISSION PROGRESS =====================

@Composable
fun MissionProgressCard() {
    val animProgress = remember { Animatable(0f) }
    LaunchedEffect(Unit) { animProgress.animateTo(0.15f, tween(1200, easing = FastOutSlowInEasing)) }

    Card(
        modifier  = Modifier.fillMaxWidth().border(1.dp, AccentPurple.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
        colors    = CardDefaults.cardColors(BgCard),
        shape     = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(0.dp)
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(48.dp)
                    .background(AccentPurple.copy(alpha = 0.15f), CircleShape)
                    .border(1.dp, AccentPurple.copy(alpha = 0.4f), CircleShape),
                contentAlignment = Alignment.Center
            ) { Text("🎯", fontSize = 22.sp) }

            Spacer(Modifier.width(14.dp))

            Column(Modifier.weight(1f)) {
                Text("Mission Progress", color = AccentPurple, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(Modifier.height(4.dp))
                Text("Help us build the best keyboard for India", color = TextSecondary, fontSize = 11.sp)
                Spacer(Modifier.height(8.dp))

                Box(
                    modifier = Modifier.fillMaxWidth().height(6.dp)
                        .clip(RoundedCornerShape(3.dp)).background(BgCardBorder)
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth(animProgress.value).fillMaxHeight()
                            .clip(RoundedCornerShape(3.dp))
                            .background(Brush.horizontalGradient(listOf(AccentPurple, AccentBlue)))
                    )
                }
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("1,500 / 10,000 samples collected", color = TextMuted,   fontSize = 10.sp)
                    Text("15%",                              color = AccentPurple, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ===================== BOTTOM NAV =====================

@Composable
fun BottomNavBar(selectedTab: Int, onTabSelected: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth()
            .background(Color(0xFF0C1520))
            .border(1.dp, BgCardBorder, RoundedCornerShape(topStart = 0.dp, topEnd = 0.dp))
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        NavItem("🏠", "Home",     selectedTab == 0, AccentPurple) { onTabSelected(0) }
        NavItem("🎨", "Themes",   selectedTab == 1, AccentPurple) { onTabSelected(1) }
        NavItem("⚙️", "Settings", selectedTab == 2, AccentPurple) { onTabSelected(2) }
    }
}

@Composable
fun NavItem(icon: String, label: String, selected: Boolean, accentColor: Color, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onClick() }.padding(horizontal = 20.dp, vertical = 4.dp)
    ) {
        Text(icon, fontSize = 22.sp)
        Spacer(Modifier.height(3.dp))
        Text(label,
            color      = if (selected) accentColor else TextMuted,
            fontSize   = 11.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
        )
        if (selected) {
            Spacer(Modifier.height(3.dp))
            Box(modifier = Modifier.size(4.dp).background(accentColor, CircleShape))
        }
    }
}

// ===================== KEYBOARD STATE FUNCTIONS =====================

fun isKeyboardEnabledStatic(context: Context): Boolean {
    val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    return imm.enabledInputMethodList.any { it.packageName == context.packageName }
}

fun isKeyboardSelectedStatic(context: Context): Boolean {
    val current = Settings.Secure.getString(context.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
    return current?.contains(context.packageName) == true
}
