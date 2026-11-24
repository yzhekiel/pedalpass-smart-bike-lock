#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ESP32Servo.h>
#include "esp_wifi.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

/**
 * ============================================================================
 * SMART BIKE LOCK IoT SYSTEM — MILESTONE 2: ESP32 FIRMWARE (PlatformIO main.cpp)
 * Complete Servo, 3-LED (Green/Yellow/Red), Buzzer & Mobile App Controller
 * ============================================================================
 *
 * HARDWARE PINOUT (Matched to Your Verified 2-Layer FR4 PCB Layout):
 * ----------------------------------------------------------------------------
 * - ESP32 VIN (5V Pin 1)   <-- Left Green MP1584EN #1 OUT+ (Calibrated to 5.00V)
 * - MG996R & SG90 VCC      <-- Right Green MP1584EN #2 OUT+ (Calibrated to 5.00V)
 * - Common Star Ground     <-- 3S BMS P-, Both MP1584EN GND, ESP32 GND (Pins 6,13,19)
 *
 * - GPIO 17 (Pin 9)        --> MG996R Metal-Gear Servo (Curved C-Shackle Bolt)
 * - GPIO 18 (Pin 11)       --> SG90 Micro Servo (Deadbolt Locking Pin)
 * - GPIO 19 (Pin 12)       --> Active Piezo Buzzer (+) [Audio Feedback & Alarm]
 * - GPIO 21 (Pin 14)       --> 220-Ohm Resistor #1 --> Red LED (+) [Locked / Available]
 * - GPIO 22 (Pin 17)       --> 220-Ohm Resistor #2 --> Yellow LED (+) [On Park / Temp Lock]
 * - GPIO 23 (Pin 18)       --> 220-Ohm Resistor #3 --> Green LED (+) [Unlocked / Riding]
 * - GPIO 26 (Top Pin 10)   <-- Optional SW-420 Vibration Sensor DO (INPUT_PULLDOWN)
 * - GPIO 27 (Top Pin 9)    <-- Optional KW11-3Z Limit Switch NO (INPUT_PULLUP)
 * ============================================================================
 */

// ============================================================================
// 1. WIFI SOFTAP CONFIGURATION (1-DEVICE SLOT LIMIT: max_connection = 1)
// ============================================================================
const char* BIKE_ID      = "bike01";
const char* AP_SSID      = "Bike01_Lock";
const char* AP_PASS      = "smartbike01";  // WPA2 password (min 8 chars)
const int   AP_CHANNEL   = 1;
const int   AP_HIDDEN    = 0;
const int   AP_MAX_CONN  = 1;              // 1 student connection slot at a time

// ============================================================================
// 2. GPIO PIN DEFINITIONS (MATCHED TO YOUR VERIFIED 2-LAYER PCB)
// ============================================================================
const int PIN_BUILTIN_LED  = 2;   // Onboard Blue LED on ESP32 (lights up when Wi-Fi AP is ready!)
const int PIN_SERVO_CLATCH = 17;  // MG996R Curved C-Shackle Servo (Pin 11 from left on rotated header)
const int PIN_SERVO_LOCK   = 18;  // SG90 Deadbolt Pin Servo (Pin 9 from left on rotated header)
const int PIN_BUZZER       = 19;  // Active Piezo Buzzer (+) (Pin 8 from left on rotated header)
const int PIN_LED_RED      = 21;  // Red LED (+) via 220-ohm [Locked / Available] (Pin 6)
const int PIN_LED_YELLOW   = 22;  // Yellow LED (+) via 220-ohm [On Park / Temp Locked] (Pin 3)
const int PIN_LED_GREEN    = 23;  // Green LED (+) via 220-ohm [Unlocked / Riding] (Pin 2)
const int PIN_VIBRATION    = 26;  // Optional SW-420 Vibration Sensor DO
const int PIN_LIMIT_SW     = 27;  // Optional KW11-3Z Limit Switch NO

// ============================================================================
// 3. SERVO ANGLES & TIMING CONSTANTS
// ============================================================================
int CLATCH_ANGLE_CLOSED = 0;    // MG996R 0°   = Shackle closed
int CLATCH_ANGLE_OPEN   = 180;  // MG996R 180° = Shackle open

int PIN_ANGLE_RETRACTED = 0;    // SG90 0°  = Deadbolt pin retracted (unlocked)
int PIN_ANGLE_ENGAGED   = 90;   // SG90 90° = Deadbolt pin engaged (locked into notch)

const unsigned long STATIONARY_REQUIRED_MS = 3000;
const unsigned long IDLE_CLIENT_KICK_MS    = 180000;
const unsigned long PRE_ALARM_WINDOW_MS    = 10000;
const unsigned long FULL_SIREN_DURATION_MS = 10000;

bool enforceLimitSwitchCheck = false;
bool deauthOnReturn          = false;

// ============================================================================
// 4. THE 4-STATE LOCK LIFECYCLE
// ============================================================================
enum LockState {
  STATE_AVAILABLE          = 0,  // Red LED ON    | Physically Locked | Free to borrow
  STATE_IN_USE_RIDING      = 1,  // Green LED ON  | Physically Open   | Bound to Ride Token
  STATE_IN_USE_TEMP_LOCKED = 2,  // Yellow LED ON | Physically Locked | Bound to Ride Token (On Park!)
  STATE_RETURNED           = 3   // Red LED ON    | Physically Locked | Session ended
};

// ============================================================================
// 5. GLOBAL OBJECTS & RUNTIME STATE
// ============================================================================
WebServer   server(80);
Preferences prefs;
Servo       cLatchServo;
Servo       pinServo;

LockState   currentState           = STATE_AVAILABLE;
String      activeRideToken        = "";
String      activeStudentId        = "";
int         tempLockCount          = 0;
int         lastCLatchAngle        = 0;
int         lastPinAngle           = 90;

unsigned long lastVibrationMs      = 0;
unsigned long lastClientActivityMs = 0;
uint8_t       connectedClientCount = 0;

bool          preAlarmTriggered    = false;
unsigned long preAlarmTimestampMs  = 0;
bool          fullSirenActive      = false;
unsigned long fullSirenStartMs     = 0;
unsigned long lastVibrationBurstMs = 0;
int           vibrationPulseCount  = 0;
unsigned long manualLedOverrideMs  = 0;  // Pauses automatic state LED during manual bench tests

// ============================================================================
// 6. ACOUSTIC & 3-LED STATUS FEEDBACK (RED / YELLOW PARK / GREEN RIDE)
// ============================================================================
void beepTone(int onMs, int offMs, int repeats = 1) {
  for (int i = 0; i < repeats; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(onMs);
    digitalWrite(PIN_BUZZER, LOW);
    if (i + 1 < repeats || offMs > 0) {
      delay(offMs);
    }
  }
}

void soundUnlockSuccess() {
  beepTone(70, 50, 1);
  beepTone(140, 0, 1);
}

void soundTempLockPark() {
  beepTone(220, 0, 1);
}

void soundReturnComplete() {
  beepTone(160, 80, 2);
}

void soundSpokeHazardAbort() {
  for (int i = 0; i < 4; i++) {
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_BUZZER, HIGH);
    delay(80);
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    delay(60);
  }
}

void soundPreAlarmWarning() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_BUZZER, HIGH);
    delay(110);
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    delay(90);
  }
}

void updateStatusLEDs() {
  if (fullSirenActive) {
    return;
  }
  // If user clicked a manual LED test button in the last 20 seconds, do not overwrite it!
  if (manualLedOverrideMs > 0 && (millis() - manualLedOverrideMs < 20000)) {
    return;
  }
  manualLedOverrideMs = 0;

  if (currentState == STATE_IN_USE_RIDING) {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);
  } else if (currentState == STATE_IN_USE_TEMP_LOCKED) {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
  } else {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
  }
}

void runBootSelfTest() {
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);

  // Blink onboard Blue LED (GPIO 2) + external Red -> Yellow -> Green LEDs
  digitalWrite(PIN_BUILTIN_LED, HIGH);
  digitalWrite(PIN_LED_RED, HIGH);
  delay(200);
  digitalWrite(PIN_BUILTIN_LED, LOW);
  digitalWrite(PIN_LED_RED, LOW);

  digitalWrite(PIN_BUILTIN_LED, HIGH);
  digitalWrite(PIN_LED_YELLOW, HIGH);
  delay(200);
  digitalWrite(PIN_BUILTIN_LED, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);

  digitalWrite(PIN_BUILTIN_LED, HIGH);
  digitalWrite(PIN_LED_GREEN, HIGH);
  delay(200);
  digitalWrite(PIN_LED_GREEN, LOW);

  beepTone(60, 50, 2);
  updateStatusLEDs();
}

// ============================================================================
// 7. SEQUENTIAL DUAL-SERVO INTERLOCK (MOVES 1 SERVO AT A TIME, THEN DETACHES)
// ============================================================================
void movePinServo(int targetAngle, int waitMs = 420) {
  pinServo.attach(PIN_SERVO_LOCK, 500, 2400);
  pinServo.write(targetAngle);
  delay(waitMs);
  pinServo.detach();
  lastPinAngle = targetAngle;
}

void moveCLatchServo(int targetAngle, int waitMs = 850) {
  cLatchServo.attach(PIN_SERVO_CLATCH, 500, 2400);
  cLatchServo.write(targetAngle);
  delay(waitMs);
  cLatchServo.detach();
  lastCLatchAngle = targetAngle;
}

void executePhysicalUnlock() {
  movePinServo(PIN_ANGLE_RETRACTED, 400);
  moveCLatchServo(CLATCH_ANGLE_OPEN, 850);
  movePinServo(PIN_ANGLE_ENGAGED, 400);
}

bool executePhysicalLock(String &errorReason) {
  if (lastVibrationMs > 0 && (millis() - lastVibrationMs < STATIONARY_REQUIRED_MS)) {
    errorReason = "SPOKE_HAZARD_WHEEL_MOVING: Stop bike completely for 3 seconds before locking.";
    soundSpokeHazardAbort();
    return false;
  }

  movePinServo(PIN_ANGLE_RETRACTED, 400);

  cLatchServo.attach(PIN_SERVO_CLATCH, 500, 2400);
  cLatchServo.write(CLATCH_ANGLE_CLOSED);
  delay(850);
  lastCLatchAngle = CLATCH_ANGLE_CLOSED;

  bool limitClosedCleanly = (digitalRead(PIN_LIMIT_SW) == LOW);
  if (enforceLimitSwitchCheck && !limitClosedCleanly) {
    cLatchServo.write(CLATCH_ANGLE_OPEN);
    delay(850);
    cLatchServo.detach();
    lastCLatchAngle = CLATCH_ANGLE_OPEN;
    movePinServo(PIN_ANGLE_ENGAGED, 400);
    soundSpokeHazardAbort();
    errorReason = "SPOKE_OBSTRUCTION_AUTO_REVERSED: Shackle touched a spoke and auto-retracted to Open!";
    return false;
  }

  cLatchServo.detach();
  movePinServo(PIN_ANGLE_ENGAGED, 400);

  preAlarmTriggered = false;
  fullSirenActive   = false;
  return true;
}

// ============================================================================
// 8. NON-VOLATILE FLASH PERSISTENCE
// ============================================================================
void saveStateToFlash() {
  prefs.begin("bikelock", false);
  prefs.putInt("state", (int)currentState);
  prefs.putString("token", activeRideToken);
  prefs.putString("student", activeStudentId);
  prefs.putInt("tcount", tempLockCount);
  prefs.end();
}

void loadStateFromFlash() {
  prefs.begin("bikelock", true);
  currentState    = (LockState)prefs.getInt("state", (int)STATE_AVAILABLE);
  activeRideToken = prefs.getString("token", "");
  activeStudentId = prefs.getString("student", "");
  tempLockCount   = prefs.getInt("tcount", 0);
  prefs.end();
  lastCLatchAngle = (currentState == STATE_IN_USE_RIDING) ? CLATCH_ANGLE_OPEN : CLATCH_ANGLE_CLOSED;
  lastPinAngle    = PIN_ANGLE_ENGAGED;
}

String stateToString(LockState s) {
  switch (s) {
    case STATE_AVAILABLE:          return "AVAILABLE";
    case STATE_IN_USE_RIDING:      return "IN_USE_RIDING";
    case STATE_IN_USE_TEMP_LOCKED: return "IN_USE_TEMP_LOCKED";
    case STATE_RETURNED:           return "RETURNED";
    default:                       return "UNKNOWN";
  }
}

// ============================================================================
// 9. CORS & JSON API ENDPOINTS (APP WORKFLOW + HARDWARE DIAGNOSTICS)
// ============================================================================
void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-Ride-Token");
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

void recordClientActivity() {
  lastClientActivityMs = millis();
}

void handleApiStatus() {
  recordClientActivity();
  sendCorsHeaders();
  bool wheelStationary = (lastVibrationMs == 0) || (millis() - lastVibrationMs >= STATIONARY_REQUIRED_MS);
  bool limitClosed     = (digitalRead(PIN_LIMIT_SW) == LOW);

  String json = "{";
  json += "\"bike_id\":\"" + String(BIKE_ID) + "\",";
  json += "\"state\":\"" + stateToString(currentState) + "\",";
  json += "\"active_student\":\"" + activeStudentId + "\",";
  json += "\"has_active_token\":" + String(activeRideToken.length() > 0 ? "true" : "false") + ",";
  json += "\"physically_locked\":" + String((currentState != STATE_IN_USE_RIDING) ? "true" : "false") + ",";
  json += "\"clatch_angle\":" + String(lastCLatchAngle) + ",";
  json += "\"pin_angle\":" + String(lastPinAngle) + ",";
  json += "\"wheel_stationary\":" + String(wheelStationary ? "true" : "false") + ",";
  json += "\"limit_switch_closed\":" + String(limitClosed ? "true" : "false") + ",";
  json += "\"enforce_limit_sw\":" + String(enforceLimitSwitchCheck ? "true" : "false") + ",";
  json += "\"temp_lock_count\":" + String(tempLockCount) + ",";
  json += "\"alarm_active\":" + String(fullSirenActive ? "true" : "false");
  json += "}";
  server.send(200, "application/json", json);
}

void handleApiUnlock() {
  recordClientActivity();
  sendCorsHeaders();
  String token     = server.arg("token");
  String studentId = server.arg("student_id");
  if (studentId.length() == 0) studentId = "2023-STUDENT";

  if (token.length() < 3) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"Please enter or generate a Ride Token first.\"}");
    return;
  }

  if (currentState == STATE_AVAILABLE || currentState == STATE_RETURNED) {
    manualLedOverrideMs = 0;
    activeRideToken = token;
    activeStudentId = studentId;
    tempLockCount   = 0;
    currentState    = STATE_IN_USE_RIDING;
    saveStateToFlash();

    updateStatusLEDs();
    executePhysicalUnlock();
    soundUnlockSuccess();

    server.send(200, "application/json",
      "{\"ok\":true,\"bike_id\":\"" + String(BIKE_ID) + "\",\"state\":\"IN_USE_RIDING\",\"message\":\"GREEN LED ON: SG90 retracted (0°), MG996R opened (180°), SG90 pinned open (90°).\"}");
    return;
  }

  if (currentState == STATE_IN_USE_TEMP_LOCKED || currentState == STATE_IN_USE_RIDING) {
    if (token != activeRideToken) {
      soundSpokeHazardAbort();
      updateStatusLEDs();
      server.send(403, "application/json",
        "{\"ok\":false,\"error\":\"ACCESS DENIED: Bike is currently parked/reserved by another student's Ride Token!\"}");
      return;
    }
    currentState = STATE_IN_USE_RIDING;
    saveStateToFlash();

    updateStatusLEDs();
    executePhysicalUnlock();
    soundUnlockSuccess();

    server.send(200, "application/json",
      "{\"ok\":true,\"bike_id\":\"" + String(BIKE_ID) + "\",\"state\":\"IN_USE_RIDING\",\"message\":\"GREEN LED ON: Ride resumed from Park! Shackle unlocked (180°).\"}");
    return;
  }
}

void handleApiTempLock() {
  recordClientActivity();
  sendCorsHeaders();
  String token = server.arg("token");

  if (currentState != STATE_IN_USE_RIDING) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"Bike must be in IN_USE_RIDING state to engage Temporary Park Lock.\"}");
    return;
  }
  if (token != activeRideToken) {
    soundSpokeHazardAbort();
    updateStatusLEDs();
    server.send(403, "application/json", "{\"ok\":false,\"error\":\"INVALID_RIDE_TOKEN: Token does not match active borrower.\"}");
    return;
  }

  String err = "";
  if (!executePhysicalLock(err)) {
    server.send(409, "application/json", "{\"ok\":false,\"error\":\"" + err + "\"}");
    return;
  }

  currentState = STATE_IN_USE_TEMP_LOCKED;
  manualLedOverrideMs = 0;
  tempLockCount++;
  saveStateToFlash();
  updateStatusLEDs();
  soundTempLockPark();

  server.send(200, "application/json",
    "{\"ok\":true,\"bike_id\":\"" + String(BIKE_ID) + "\",\"state\":\"IN_USE_TEMP_LOCKED\",\"temp_lock_count\":" + String(tempLockCount) + ",\"message\":\"YELLOW PARK LED ON: MG996R closed (0°) & SG90 pinned (90°). Bike reserved for you!\"}");
}

void handleApiReturn() {
  recordClientActivity();
  sendCorsHeaders();
  String token = server.arg("token");

  if (currentState != STATE_IN_USE_RIDING && currentState != STATE_IN_USE_TEMP_LOCKED) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"Bike is already AVAILABLE (no active ride to return).\"}");
    return;
  }
  if (token != activeRideToken) {
    soundSpokeHazardAbort();
    updateStatusLEDs();
    server.send(403, "application/json", "{\"ok\":false,\"error\":\"INVALID_RIDE_TOKEN: Only the active borrower can return this bike.\"}");
    return;
  }

  if (currentState == STATE_IN_USE_RIDING) {
    String err = "";
    if (!executePhysicalLock(err)) {
      server.send(409, "application/json", "{\"ok\":false,\"error\":\"" + err + "\"}");
      return;
    }
  }

  int finalTempLocks   = tempLockCount;
  String finishedToken = activeRideToken;
  String finishedStud  = activeStudentId;

  currentState    = STATE_AVAILABLE;
  manualLedOverrideMs = 0;
  activeRideToken = "";
  activeStudentId = "";
  tempLockCount   = 0;
  saveStateToFlash();
  updateStatusLEDs();
  soundReturnComplete();

  String receiptJson = "{";
  receiptJson += "\"ok\":true,";
  receiptJson += "\"bike_id\":\"" + String(BIKE_ID) + "\",";
  receiptJson += "\"state\":\"AVAILABLE\",";
  receiptJson += "\"student_id\":\"" + finishedStud + "\",";
  receiptJson += "\"lock_confirmed\":true,";
  receiptJson += "\"temp_lock_count\":" + String(finalTempLocks) + ",";
  receiptJson += "\"ride_token\":\"" + finishedToken + "\",";
  receiptJson += "\"message\":\"RED LED ON: Ride ended & bike locked. Slot released back to AVAILABLE!\"";
  receiptJson += "}";
  server.send(200, "application/json", receiptJson);

  if (deauthOnReturn) {
    delay(600);
    esp_wifi_deauth_sta(0);
  }
}

void handleApiTest() {
  recordClientActivity();
  sendCorsHeaders();
  String target = server.arg("target");
  int    val    = server.arg("val").toInt();
  String msg    = "";

  if (target == "mg996r") {
    val = constrain(val, 0, 180);
    moveCLatchServo(val, 800);
    msg = "MG996R (GPIO 17) moved to " + String(val) + "° and detached PWM.";
  } else if (target == "sg90") {
    val = constrain(val, 0, 180);
    movePinServo(val, 420);
    msg = "SG90 (GPIO 18) moved to " + String(val) + "° and detached PWM.";
  } else if (target == "led_red") {
    manualLedOverrideMs = millis();
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);
    msg = "RED LED (GPIO 21) turned ON (Yellow & Green OFF).";
  } else if (target == "led_yellow") {
    manualLedOverrideMs = millis();
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_GREEN, LOW);
    msg = "YELLOW PARK LED (GPIO 22) turned ON (Red & Green OFF).";
  } else if (target == "led_green") {
    manualLedOverrideMs = millis();
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, HIGH);
    msg = "GREEN RIDE LED (GPIO 23) turned ON (Red & Yellow OFF).";
  } else if (target == "led_all") {
    manualLedOverrideMs = millis();
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_GREEN, HIGH);
    msg = "All 3 LEDs (GPIO 21, 22, 23) turned ON simultaneously.";
  } else if (target == "led_off") {
    manualLedOverrideMs = millis();
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);
    msg = "All 3 LEDs turned OFF.";
  } else if (target == "buzzer_beep") {
    soundUnlockSuccess();
    msg = "Piezo Buzzer (GPIO 19) played unlock beep.";
  } else if (target == "buzzer_prealarm") {
    soundPreAlarmWarning();
    updateStatusLEDs();
    msg = "Piezo Buzzer (GPIO 19) played I LOCK IT PRO Triple Pre-Alarm.";
  } else if (target == "selftest") {
    runBootSelfTest();
    msg = "Executed full LED + Buzzer boot self-test.";
  } else if (target == "toggle_limit") {
    enforceLimitSwitchCheck = !enforceLimitSwitchCheck;
    msg = String("Limit Switch (GPIO 27) enforcement is now ") + (enforceLimitSwitchCheck ? "ENABLED" : "DISABLED");
  } else {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"UNKNOWN_TEST_TARGET\"}");
    return;
  }

  server.send(200, "application/json", "{\"ok\":true,\"message\":\"" + msg + "\"}");
}

void handleApiReset() {
  recordClientActivity();
  sendCorsHeaders();
  currentState      = STATE_AVAILABLE;
  activeRideToken   = "";
  activeStudentId   = "";
  tempLockCount     = 0;
  fullSirenActive   = false;
  preAlarmTriggered = false;
  saveStateToFlash();

  movePinServo(PIN_ANGLE_RETRACTED, 350);
  moveCLatchServo(CLATCH_ANGLE_CLOSED, 800);
  movePinServo(PIN_ANGLE_ENGAGED, 350);
  updateStatusLEDs();
  beepTone(120, 60, 2);

  server.send(200, "application/json",
    "{\"ok\":true,\"state\":\"AVAILABLE\",\"message\":\"Reset to AVAILABLE: Shackle closed (0°), Pin engaged (90°), Red LED ON, Token cleared.\"}");
}

// ============================================================================
// 10. BUILT-IN MOBILE APP & HARDWARE DIAGNOSTIC PORTAL (http://192.168.4.1)
// ============================================================================
void handleRootUi() {
  recordClientActivity();
  String html = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Smart Bike Lock — bike01 Tester & App</title>
<style>
  :root { --bg: #0f172a; --card: #1e293b; --border: #334155; }
  body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: #f8fafc; margin: 0; padding: 14px; }
  .wrap { max-width: 480px; margin: 0 auto; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 18px; margin-bottom: 14px; box-shadow: 0 8px 20px rgba(0,0,0,0.35); }
  h2, h3 { margin: 0 0 10px 0; }
  .status-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.4px; }
  .AVAILABLE { background: #dc2626; color: #fff; }
  .IN_USE_RIDING { background: #16a34a; color: #fff; }
  .IN_USE_TEMP_LOCKED { background: #eab308; color: #0f172a; }
  .led-bar { display: flex; gap: 12px; justify-content: center; margin: 12px 0; padding: 10px; background: #0f172a; border-radius: 12px; }
  .led-dot { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 700; opacity: 0.3; transition: 0.2s; }
  .led-dot.active { opacity: 1; transform: scale(1.06); }
  .circle { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }
  .c-red { background: #ef4444; box-shadow: 0 0 10px #ef4444; }
  .c-yel { background: #eab308; box-shadow: 0 0 10px #eab308; }
  .c-grn { background: #22c55e; box-shadow: 0 0 10px #22c55e; }
  input { width: 100%; box-sizing: border-box; padding: 11px 12px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: #fff; margin-bottom: 10px; font-size: 0.95rem; }
  button { width: 100%; padding: 12px; border-radius: 10px; border: none; font-weight: 700; font-size: 0.95rem; margin-bottom: 8px; cursor: pointer; transition: 0.15s; }
  button:active { transform: scale(0.98); }
  .btn-unlock { background: #16a34a; color: #fff; }
  .btn-park { background: #eab308; color: #0f172a; }
  .btn-return { background: #dc2626; color: #fff; }
  .btn-sub { background: #334155; color: #e2e8f0; font-size: 0.85rem; padding: 10px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  #msg { background: #0f172a; border-left: 4px solid #38bdf8; padding: 10px 12px; border-radius: 8px; font-size: 0.88rem; color: #bae6fd; min-height: 20px; margin-top: 8px; }
  .meta { font-size: 0.82rem; color: #94a3b8; margin-bottom: 10px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="status-row">
      <h2>🚲 Smart Bike Lock (bike01)</h2>
      <div id="stateBadge" class="badge AVAILABLE">AVAILABLE</div>
    </div>
    <div class="led-bar">
      <div id="ledRed" class="led-dot active"><span class="circle c-red"></span>RED (Locked)</div>
      <div id="ledYel" class="led-dot"><span class="circle c-yel"></span>YELLOW (On Park)</div>
      <div id="ledGrn" class="led-dot"><span class="circle c-grn"></span>GREEN (Riding)</div>
    </div>
    <div id="sensorInfo" class="meta">MG996R: 0° | SG90 Pin: 90° | Park Count: 0</div>

    <div style="display:flex;gap:8px;">
      <input id="tokenInput" placeholder="Ride Token (e.g. RIDE-2026-A1)" style="margin-bottom:8px;" />
      <button class="btn-sub" style="width:130px;margin-bottom:8px;" onclick="genToken()">🎲 New Token</button>
    </div>

    <button class="btn-unlock" onclick="sendCmd('/api/unlock')">🟢 1. Borrow / Unlock (or Resume Ride)</button>
    <button class="btn-park" onclick="sendCmd('/api/templock')">🟡 2. Park Outside Classroom (Temp Lock)</button>
    <button class="btn-return" onclick="sendCmd('/api/return')">🔴 3. End Ride & Return Bike</button>
    <div id="msg">Ready. Tap "New Token" then "Borrow / Unlock" to test the 4-state flow!</div>
  </div>

  <div class="card">
    <h3>🛠️ Hardware Bench Test (Direct Servo / LED / Buzzer)</h3>
    <p class="meta">Test each component on your FR4 PCB individually:</p>

    <div class="meta" style="color:#fdba74;font-weight:700;">MG996R C-Latch Servo (GPIO 17):</div>
    <div class="grid-3">
      <button class="btn-sub" onclick="hwTest('mg996r',0)">0° (Closed)</button>
      <button class="btn-sub" onclick="hwTest('mg996r',90)">90° (Half)</button>
      <button class="btn-sub" onclick="hwTest('mg996r',180)">180° (Open)</button>
    </div>

    <div class="meta" style="color:#60a5fa;font-weight:700;margin-top:6px;">SG90 Deadbolt Pin Servo (GPIO 18):</div>
    <div class="grid-2">
      <button class="btn-sub" onclick="hwTest('sg90',0)">0° (Pin Retracted)</button>
      <button class="btn-sub" onclick="hwTest('sg90',90)">90° (Pin Engaged)</button>
    </div>

    <div class="meta" style="color:#cbd5e1;font-weight:700;margin-top:6px;">3 Status LEDs (GPIO 21, 22, 23) & Buzzer (GPIO 19):</div>
    <div class="grid-3">
      <button class="btn-sub" style="border:1px solid #ef4444;" onclick="hwTest('led_red',1)">🔴 Red (G21)</button>
      <button class="btn-sub" style="border:1px solid #eab308;" onclick="hwTest('led_yellow',1)">🟡 Park (G22)</button>
      <button class="btn-sub" style="border:1px solid #22c55e;" onclick="hwTest('led_green',1)">🟢 Green (G23)</button>
    </div>
    <div class="grid-2">
      <button class="btn-sub" onclick="hwTest('buzzer_beep',1)">🔊 Buzzer Beep (G19)</button>
      <button class="btn-sub" onclick="hwTest('buzzer_prealarm',1)">🚨 Triple Pre-Alarm</button>
    </div>
    <div class="grid-2" style="margin-top:4px;">
      <button class="btn-sub" onclick="hwTest('selftest',1)">✨ Run Full Self-Test</button>
      <button class="btn-sub" style="background:#7f1d1d;color:#fecaca;" onclick="resetLock()">🔄 Force Reset Lock</button>
    </div>
  </div>
</div>

<script>
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('token')) {
    document.getElementById('tokenInput').value = urlParams.get('token');
    localStorage.setItem('bike01_token', urlParams.get('token'));
  } else if (localStorage.getItem('bike01_token')) {
    document.getElementById('tokenInput').value = localStorage.getItem('bike01_token');
  } else {
    genToken();
  }

  function genToken() {
    const t = 'RIDE-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    document.getElementById('tokenInput').value = t;
    localStorage.setItem('bike01_token', t);
  }

  async function refreshStatus() {
    try {
      const res = await fetch('/api/status');
      const d = await res.json();
      const b = document.getElementById('stateBadge');
      b.textContent = d.state === 'IN_USE_TEMP_LOCKED' ? 'ON PARK (TEMP LOCKED)' : d.state;
      b.className = 'badge ' + d.state;

      document.getElementById('ledRed').className = 'led-dot' + (d.state === 'AVAILABLE' || d.state === 'RETURNED' ? ' active' : '');
      document.getElementById('ledYel').className = 'led-dot' + (d.state === 'IN_USE_TEMP_LOCKED' ? ' active' : '');
      document.getElementById('ledGrn').className = 'led-dot' + (d.state === 'IN_USE_RIDING' ? ' active' : '');

      document.getElementById('sensorInfo').textContent =
        'MG996R (G17): ' + d.clatch_angle + '° | SG90 Pin (G18): ' + d.pin_angle +
        '° | Park Count: ' + d.temp_lock_count;
    } catch (e) {}
  }

  async function sendCmd(path) {
    let token = document.getElementById('tokenInput').value.trim();
    if (!token) { genToken(); token = document.getElementById('tokenInput').value.trim(); }
    localStorage.setItem('bike01_token', token);
    document.getElementById('msg').textContent = 'Running servo sequence...';
    try {
      const res = await fetch(path + '?token=' + encodeURIComponent(token), { method: 'POST' });
      const d = await res.json();
      document.getElementById('msg').textContent = d.message || d.error;
      refreshStatus();
    } catch (e) {
      document.getElementById('msg').textContent = 'Request failed or Wi-Fi disconnected.';
    }
  }

  async function hwTest(target, val) {
    document.getElementById('msg').textContent = 'Testing ' + target + '...';
    try {
      const res = await fetch('/api/test?target=' + target + '&val=' + val, { method: 'POST' });
      const d = await res.json();
      document.getElementById('msg').textContent = d.message || d.error;
      refreshStatus();
    } catch (e) {
      document.getElementById('msg').textContent = 'Error communicating with ESP32.';
    }
  }

  async function resetLock() {
    document.getElementById('msg').textContent = 'Resetting bike01 to AVAILABLE...';
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const d = await res.json();
      genToken();
      document.getElementById('msg').textContent = d.message;
      refreshStatus();
    } catch (e) {}
  }

  refreshStatus();
  setInterval(refreshStatus, 2000);
</script>
</body>
</html>
)rawliteral";
  server.send(200, "text/html", html);
}

// ============================================================================
// 11. "I LOCK IT PRO" 2-STAGE ANTI-THEFT ALARM & VIBRATION MONITOR
// ============================================================================
void monitorVibrationAndAlarm() {
  bool vibDetected = (digitalRead(PIN_VIBRATION) == HIGH);

  if (vibDetected) {
    lastVibrationMs = millis();

    if (currentState != STATE_IN_USE_RIDING && !fullSirenActive) {
      if (millis() - lastVibrationBurstMs > 250) {
        lastVibrationBurstMs = millis();
        vibrationPulseCount++;
      }

      if (!preAlarmTriggered && vibrationPulseCount >= 3) {
        preAlarmTriggered   = true;
        preAlarmTimestampMs = millis();
        vibrationPulseCount = 0;
        soundPreAlarmWarning();
        updateStatusLEDs();
      } else if (preAlarmTriggered && (millis() - preAlarmTimestampMs <= PRE_ALARM_WINDOW_MS) && vibrationPulseCount >= 3) {
        fullSirenActive     = true;
        fullSirenStartMs    = millis();
        vibrationPulseCount = 0;
      }
    }
  }

  if (preAlarmTriggered && (millis() - preAlarmTimestampMs > PRE_ALARM_WINDOW_MS)) {
    preAlarmTriggered   = false;
    vibrationPulseCount = 0;
  }

  if (fullSirenActive) {
    unsigned long elapsed = millis() - fullSirenStartMs;
    if (elapsed >= FULL_SIREN_DURATION_MS) {
      fullSirenActive   = false;
      preAlarmTriggered = false;
      digitalWrite(PIN_BUZZER, LOW);
      updateStatusLEDs();
    } else {
      bool fastPhase = ((elapsed / 120) % 2 == 0);
      digitalWrite(PIN_BUZZER, fastPhase ? HIGH : LOW);
      digitalWrite(PIN_LED_RED, fastPhase ? HIGH : LOW);
    }
  }
}

// ============================================================================
// 12. POCKET AUTO-RECONNECT SLOT HIJACK PROTECTION (max_connection = 1)
// ============================================================================
void checkIdleClientTimeout() {
  wifi_sta_list_t staList;
  esp_wifi_ap_get_sta_list(&staList);

  if (staList.num > 0 && connectedClientCount == 0) {
    connectedClientCount = staList.num;
    lastClientActivityMs = millis();
  } else if (staList.num == 0) {
    connectedClientCount = 0;
  }

  if (connectedClientCount > 0 && (millis() - lastClientActivityMs > IDLE_CLIENT_KICK_MS)) {
    esp_wifi_deauth_sta(0);
    connectedClientCount = 0;
  }
}

// ============================================================================
// 13. ARDUINO SETUP & MAIN LOOP
// ============================================================================
void setup() {
  // Disable brownout reset during Wi-Fi RF startup current spike on external 5V buck power
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  delay(250); // Allow external MP1584EN 5V buck rail to stabilize completely on power-up

  Serial.begin(115200);

  pinMode(PIN_BUILTIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_VIBRATION, INPUT_PULLDOWN);
  pinMode(PIN_LIMIT_SW, INPUT_PULLUP);

  digitalWrite(PIN_BUZZER, LOW);

  loadStateFromFlash();
  runBootSelfTest();

  // Start Wi-Fi SoftAP cleanly with low-spike TX power and keep onboard Blue LED (GPIO 2) ON
  WiFi.persistent(false);
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.setTxPower(WIFI_POWER_11dBm);
  delay(100);
  IPAddress local_IP(192, 168, 4, 1);
  IPAddress gateway(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);
  WiFi.softAPConfig(local_IP, gateway, subnet);
  bool apStarted = WiFi.softAP(AP_SSID, AP_PASS, AP_CHANNEL, AP_HIDDEN, AP_MAX_CONN);
  digitalWrite(PIN_BUILTIN_LED, apStarted ? HIGH : LOW);

  Serial.println("==========================================");
  Serial.println(apStarted ? "Smart Bike Lock SoftAP Started!" : "SoftAP Failed!");
  Serial.print("Wi-Fi SSID: "); Serial.println(AP_SSID);
  Serial.print("Password:   "); Serial.println(AP_PASS);
  Serial.print("Control URL: http://"); Serial.println(WiFi.softAPIP());
  Serial.println("==========================================");

  server.on("/", HTTP_GET, handleRootUi);
  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.on("/api/unlock", HTTP_POST, handleApiUnlock);
  server.on("/api/templock", HTTP_POST, handleApiTempLock);
  server.on("/api/return", HTTP_POST, handleApiReturn);
  server.on("/api/test", HTTP_POST, handleApiTest);
  server.on("/api/reset", HTTP_POST, handleApiReset);

  server.on("/api/status", HTTP_OPTIONS, handleOptions);
  server.on("/api/unlock", HTTP_OPTIONS, handleOptions);
  server.on("/api/templock", HTTP_OPTIONS, handleOptions);
  server.on("/api/return", HTTP_OPTIONS, handleOptions);
  server.on("/api/test", HTTP_OPTIONS, handleOptions);
  server.on("/api/reset", HTTP_OPTIONS, handleOptions);

  server.begin();
}

void loop() {
  server.handleClient();
  monitorVibrationAndAlarm();
  checkIdleClientTimeout();
  updateStatusLEDs();
}
