import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, borders, radii, fontSizes, fontWeights } from '../lib/theme';
import { appFont } from '../lib/fonts';
import {
  verifyAdminPin,
  fetchStaffEmployees,
  addStaffEmployee,
  deactivateStaffEmployee,
  toggleStaffClock,
  fetchStaffReport,
} from '../lib/api-staff';
import { printStaffReport } from '../lib/printer';

const PRIMARY = colors.primary;
const PRIMARY_SOFT = colors.primarySoft;
const CARD_BG = colors.cardBg;
const BORDER = colors.borderStrong;
const TEXT = colors.text;
const MUTED = colors.muted;
const SOFT_TEXT = colors.softText;
const GREEN = colors.success;
const RED = colors.danger;
const thinBorder = borders.thin;
const STAFF_PIN_LENGTH = 4;
const STAFF_PIN_MAX_ATTEMPTS = 5;
const STAFF_PIN_LOCK_MS = 15 * 60 * 1000;
const STAFF_ADJUST_SHIFT_URL = 'https://foodup-order-alerts-backend.onrender.com/staff/adjust-shift';

type Employee = {
  id: string;
  name: string;
  clocked_in: boolean;
  clock_in_time: string | null;
};

type ReportShift = {
  clock_in: string;
  clock_out: string | null;
};

type ReportRow = {
  employee_id: string;
  name: string;
  total_hours: number;
  shifts: ReportShift[];
};

type AdjustShiftTarget = {
  employee_id: string;
  name: string;
  clock_in: string;
  clock_out: string | null;
  shift_index?: number;
};

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(iso: string | null | undefined) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | null | undefined, isGerman: boolean) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(isGerman ? 'de-CH' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatHours(h: number) {
  if (!Number.isFinite(h) || h <= 0) return '0h 00m';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function formatDurationFromMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0h 00m';
  const totalMinutes = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function durationSince(iso: string | null | undefined) {
  const d = safeDate(iso);
  if (!d) return '0h 00m';
  return formatDurationFromMs(Date.now() - d.getTime());
}

function durationBetween(start: string, end: string | null) {
  const s = safeDate(start);
  const e = end ? safeDate(end) : new Date();
  if (!s || !e) return '0h 00m';
  return formatDurationFromMs(e.getTime() - s.getTime());
}

function dateInputValue(iso: string | null | undefined) {
  const d = safeDate(iso) || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeInputValue(iso: string | null | undefined) {
  const d = safeDate(iso) || new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.trim().split('-').map(Number);

  if (!year || !month || !day) return null;

  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateInput(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateAndTime(dateValue: string, timeValue: string, minutesDelta: number) {
  const iso = combineLocalDateTime(dateValue, timeValue);
  const d = iso ? new Date(iso) : new Date();

  if (Number.isNaN(d.getTime())) return { dateValue, timeValue };

  d.setMinutes(d.getMinutes() + minutesDelta);

  return {
    dateValue: formatDateInput(d),
    timeValue: timeInputValue(d.toISOString()),
  };
}

function monthInputValue(value: string) {
  const d = parseDateInput(value) || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function shiftMonthInput(monthValue: string, offset: number) {
  const [year, month] = monthValue.split('-').map(Number);
  const d = new Date(year || new Date().getFullYear(), (month || new Date().getMonth() + 1) - 1, 1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function calendarMonthTitle(monthValue: string, isGerman: boolean) {
  const [year, month] = monthValue.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(isGerman ? 'de-CH' : 'en-US', { month: 'long', year: 'numeric' });
}

function calendarDays(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const mondayFirstOffset = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [];

  for (let i = 0; i < mondayFirstOffset; i++) cells.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(formatDateInput(new Date(year, month - 1, day, 12, 0, 0, 0)));
  }

  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function combineLocalDateTime(dateValue: string, timeValue: string) {
  const dateParts = dateValue.trim().split('-').map(Number);
  const timeParts = timeValue.trim().split(':').map(Number);

  if (dateParts.length !== 3 || timeParts.length < 2) return null;

  const [year, month, day] = dateParts;
  const [hours, minutes] = timeParts;

  if (!year || !month || !day || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatLockRemaining(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function currentMonthString(offset: number = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr: string, isGerman: boolean) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(isGerman ? 'de-CH' : 'en-US', { month: 'long', year: 'numeric' });
}

function monthOffset(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const now = new Date();
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function showConfirm(title: string, message: string, onConfirm: () => void, confirmText: string, cancelText: string) {
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function StaffHoursCard({
  restaurantCode,
  language,
}: {
  restaurantCode: string;
  language: string;
}) {
  const isGerman = language === 'de';
  const tr = (en: string, de: string) => (isGerman ? de : en);

  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState('');
  const [wrongPinCount, setWrongPinCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockTick, setLockTick] = useState(0);
  void lockTick;
  const pinInputRef = useRef<TextInput>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [clockLoadingId, setClockLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);
  void nowTick;

  const [addModal, setAddModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [reportModal, setReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(currentMonthString());
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPrinting, setReportPrinting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustShift, setAdjustShift] = useState<AdjustShiftTarget | null>(null);
  const [adjustInDate, setAdjustInDate] = useState('');
  const [adjustInTime, setAdjustInTime] = useState('');
  const [adjustOutDate, setAdjustOutDate] = useState('');
  const [adjustOutTime, setAdjustOutTime] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'in' | 'out' | null>(null);
  const [datePickerMonth, setDatePickerMonth] = useState(monthInputValue(dateInputValue(new Date().toISOString())));

  useEffect(() => {
    if (!unlocked) {
      const timer = setTimeout(() => pinInputRef.current?.focus(), 180);
      return () => clearTimeout(timer);
    }
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || !employees.some(emp => emp.clocked_in)) return;

    const timer = setInterval(() => {
      setNowTick(value => value + 1);
    }, 60000);

    return () => clearInterval(timer);
  }, [unlocked, employees]);

  useEffect(() => {
    setUnlocked(false);
    setPinInput('');
    setPinError('');
    setEmployees([]);
    setSearchText('');
    setSelectedEmployee(null);
    setManageModal(false);
    setAdjustModal(false);
    setAdjustShift(null);
  }, [restaurantCode]);

  const pinGuardKey = useMemo(
    () => `posup_staff_pin_guard_${restaurantCode || 'unknown'}`,
    [restaurantCode]
  );

  const clearPinGuard = useCallback(async () => {
    setWrongPinCount(0);
    setLockedUntil(null);
    try {
      await AsyncStorage.removeItem(pinGuardKey);
    } catch (e) {
      console.log('Failed to clear staff PIN guard', e);
    }
  }, [pinGuardKey]);

  const savePinGuard = useCallback(async (wrongCount: number, until: number | null) => {
    setWrongPinCount(wrongCount);
    setLockedUntil(until);
    try {
      await AsyncStorage.setItem(
        pinGuardKey,
        JSON.stringify({ wrongPinCount: wrongCount, lockedUntil: until })
      );
    } catch (e) {
      console.log('Failed to save staff PIN guard', e);
    }
  }, [pinGuardKey]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(pinGuardKey);
        if (!mounted) return;

        if (!raw) {
          setWrongPinCount(0);
          setLockedUntil(null);
          return;
        }

        const parsed = JSON.parse(raw);
        const savedUntil = typeof parsed?.lockedUntil === 'number' ? parsed.lockedUntil : null;
        const savedCount = typeof parsed?.wrongPinCount === 'number' ? parsed.wrongPinCount : 0;

        if (savedUntil && Date.now() < savedUntil) {
          setWrongPinCount(STAFF_PIN_MAX_ATTEMPTS);
          setLockedUntil(savedUntil);
          return;
        }

        if (savedUntil && Date.now() >= savedUntil) {
          await AsyncStorage.removeItem(pinGuardKey);
          if (!mounted) return;
          setWrongPinCount(0);
          setLockedUntil(null);
          return;
        }

        setWrongPinCount(Math.max(0, Math.min(savedCount, STAFF_PIN_MAX_ATTEMPTS - 1)));
        setLockedUntil(null);
      } catch (e) {
        console.log('Failed to load staff PIN guard', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [pinGuardKey]);

  useEffect(() => {
    if (!lockedUntil) return;

    const timer = setInterval(() => {
      setLockTick(value => value + 1);

      if (Date.now() >= lockedUntil) {
        clearPinGuard();
        setPinError('');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lockedUntil, clearPinGuard]);

  const isPinLocked = !!lockedUntil && Date.now() < lockedUntil;
  const lockRemaining = isPinLocked ? formatLockRemaining(lockedUntil - Date.now()) : '';
  const attemptsLeft = Math.max(0, STAFF_PIN_MAX_ATTEMPTS - wrongPinCount);

  const loadEmployees = useCallback(async (quiet = false) => {
    if (!restaurantCode) return;

    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetchStaffEmployees(restaurantCode);
      if (res.success) {
        setEmployees(res.employees || []);
      }
    } catch (e) {
      console.log('Failed to load employees', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantCode]);

  const handleVerifyPin = useCallback(async (pinOverride?: string) => {
    const pin = (pinOverride ?? pinInput).trim();
    if (!pin || verifying || isPinLocked) return;

    setVerifying(true);
    setPinError('');

    try {
      const res = await verifyAdminPin(restaurantCode, pin);

      if (res.success) {
        await clearPinGuard();
        setUnlocked(true);
        setPinInput('');
        await loadEmployees(false);
      } else {
        const nextWrongCount = wrongPinCount + 1;

        if (nextWrongCount >= STAFF_PIN_MAX_ATTEMPTS) {
          const until = Date.now() + STAFF_PIN_LOCK_MS;
          await savePinGuard(STAFF_PIN_MAX_ATTEMPTS, until);
          setPinInput('');
          setPinError(
            tr(
              'Too many wrong PIN attempts. Try again in 15 minutes.',
              'Zu viele falsche PIN-Versuche. Bitte in 15 Minuten erneut versuchen.'
            )
          );
        } else {
          await savePinGuard(nextWrongCount, null);
          setPinInput('');
          setPinError(
            res.error ||
              tr(
                `Incorrect PIN. ${STAFF_PIN_MAX_ATTEMPTS - nextWrongCount} attempts left.`,
                `Falsche PIN. Noch ${STAFF_PIN_MAX_ATTEMPTS - nextWrongCount} Versuche.`
              )
          );
        }
      }
    } catch (e: any) {
      setPinError(String(e?.message || e));
    } finally {
      setVerifying(false);
    }
  }, [
    pinInput,
    verifying,
    isPinLocked,
    restaurantCode,
    clearPinGuard,
    loadEmployees,
    wrongPinCount,
    savePinGuard,
    tr,
  ]);

  useEffect(() => {
    if (unlocked || verifying || isPinLocked) return;

    const cleanPin = pinInput.trim();
    if (cleanPin.length !== STAFF_PIN_LENGTH) return;

    const timer = setTimeout(() => {
      handleVerifyPin(cleanPin);
    }, 260);

    return () => clearTimeout(timer);
  }, [pinInput, unlocked, verifying, isPinLocked, handleVerifyPin]);

  const handleToggleClock = async (employee: Employee) => {
    if (clockLoadingId) return;

    setClockLoadingId(employee.id);

    try {
      const res = await toggleStaffClock(employee.id, restaurantCode);
      if (res?.success === false) {
        console.log('Clock toggle failed', res?.error || res);
        return;
      }

      await loadEmployees(true);
      setSelectedEmployee(null);
    } catch (e) {
      console.log('Clock toggle failed', e);
    } finally {
      setClockLoadingId(null);
    }
  };

  const handleAddEmployee = async () => {
    const name = newName.trim();
    if (!name || adding) return;

    setAdding(true);

    try {
      const res = await addStaffEmployee(restaurantCode, name);
      if (res.success) {
        setNewName('');
        setAddModal(false);
        await loadEmployees(true);
      }
    } catch (e) {
      console.log('Add employee failed', e);
    } finally {
      setAdding(false);
    }
  };

  const requestDeactivate = (employee: Employee) => {
    showConfirm(
      tr('Remove employee', 'Mitarbeiter entfernen'),
      tr(
        `Remove ${employee.name} from staff hours? Previous reports stay saved.`,
        `${employee.name} aus den Arbeitszeiten entfernen? Frühere Berichte bleiben gespeichert.`
      ),
      () => handleDeactivate(employee.id),
      tr('Remove', 'Entfernen'),
      tr('Cancel', 'Abbrechen')
    );
  };

  const handleDeactivate = async (id: string) => {
    if (deleteLoadingId) return;

    setDeleteLoadingId(id);

    try {
      await deactivateStaffEmployee(id);
      setSelectedEmployee(null);
      await loadEmployees(true);
    } catch (e) {
      console.log('Deactivate failed', e);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const openAdjustShift = (target: AdjustShiftTarget) => {
    setAdjustShift(target);
    setAdjustInDate(dateInputValue(target.clock_in));
    setAdjustInTime(timeInputValue(target.clock_in));
    setAdjustOutDate(dateInputValue(target.clock_out || target.clock_in));
    setAdjustOutTime(target.clock_out ? timeInputValue(target.clock_out) : timeInputValue(new Date().toISOString()));
    setAdjustModal(true);
  };

  const closeAdjustModal = () => {
    if (adjustSaving) return;
    setAdjustModal(false);
    setAdjustShift(null);
  };

  const openAdjustDatePicker = (target: 'in' | 'out') => {
    const value = target === 'in' ? adjustInDate : adjustOutDate;
    setDatePickerMonth(monthInputValue(value || dateInputValue(new Date().toISOString())));
    setDatePickerTarget(target);
  };

  const selectAdjustDate = (value: string) => {
    if (datePickerTarget === 'in') {
      setAdjustInDate(value);
    }

    if (datePickerTarget === 'out') {
      setAdjustOutDate(value);
    }

    setDatePickerTarget(null);
  };

  const changeAdjustTime = (target: 'in' | 'out', minutesDelta: number) => {
    if (target === 'in') {
      const next = shiftDateAndTime(adjustInDate, adjustInTime, minutesDelta);
      setAdjustInDate(next.dateValue);
      setAdjustInTime(next.timeValue);
      return;
    }

    const next = shiftDateAndTime(adjustOutDate, adjustOutTime, minutesDelta);
    setAdjustOutDate(next.dateValue);
    setAdjustOutTime(next.timeValue);
  };

  const handleSaveAdjustedShift = async () => {
    if (!adjustShift) return;

    const newClockIn = combineLocalDateTime(adjustInDate, adjustInTime);
    const newClockOut = adjustShift.clock_out ? combineLocalDateTime(adjustOutDate, adjustOutTime) : null;

    if (!newClockIn || (adjustShift.clock_out && !newClockOut)) {
      Alert.alert(tr('Invalid time', 'Ungültige Zeit'), tr('Please enter date as YYYY-MM-DD and time as HH:MM.', 'Bitte Datum als YYYY-MM-DD und Zeit als HH:MM eingeben.'));
      return;
    }

    if (newClockOut && safeDate(newClockOut) && safeDate(newClockIn) && safeDate(newClockOut)!.getTime() <= safeDate(newClockIn)!.getTime()) {
      Alert.alert(tr('Invalid time', 'Ungültige Zeit'), tr('Clock out must be after clock in.', 'Ausstempeln muss nach Einstempeln sein.'));
      return;
    }

    setAdjustSaving(true);

    try {
      const res = await fetch(STAFF_ADJUST_SHIFT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_code: restaurantCode,
          employee_id: adjustShift.employee_id,
          original_clock_in: adjustShift.clock_in,
          original_clock_out: adjustShift.clock_out,
          clock_in: newClockIn,
          clock_out: newClockOut,
          shift_index: adjustShift.shift_index,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to adjust shift');
      }

      setAdjustModal(false);
      setAdjustShift(null);
      setSelectedEmployee(null);
      await loadEmployees(true);
      await openReport(reportMonth);
    } catch (e: any) {
      Alert.alert(tr('Could not save', 'Konnte nicht speichern'), String(e?.message || e));
    } finally {
      setAdjustSaving(false);
    }
  };

  const openReport = async (month: string = reportMonth) => {
    setReportMonth(month);
    setExpandedRow(null);
    setReportLoading(true);
    setReportModal(true);

    try {
      const res = await fetchStaffReport(restaurantCode, month);
      if (res.success) {
        setReportData(res.report || []);
      } else {
        setReportData([]);
      }
    } catch (e) {
      console.log('Report load failed', e);
      setReportData([]);
    } finally {
      setReportLoading(false);
    }
  };

  const handlePrintReport = async () => {
    if (reportLoading || reportData.length === 0 || reportPrinting) return;

    setReportPrinting(true);

    try {
      await printStaffReport({
        month: reportMonth,
        monthLabel: monthLabel(reportMonth, isGerman),
        employees: reportData,
      });
    } catch (e: any) {
      Alert.alert(tr('Print failed', 'Drucken fehlgeschlagen'), String(e?.message || e));
    } finally {
      setReportPrinting(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(emp => emp.name.toLowerCase().includes(q));
  }, [employees, searchText]);

  const clockedInEmployees = useMemo(() => employees.filter(emp => emp.clocked_in), [employees]);
  const clockedOutEmployees = useMemo(() => employees.filter(emp => !emp.clocked_in), [employees]);

  const totalReportHours = useMemo(
    () => reportData.reduce((sum, row) => sum + (Number(row.total_hours) || 0), 0),
    [reportData]
  );

  const selectedCurrent = selectedEmployee
    ? employees.find(emp => emp.id === selectedEmployee.id) || selectedEmployee
    : null;

  const renderPinGate = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr('Staff Hours', 'Arbeitszeiten')}</Text>
      </View>

      <View style={styles.unlockCard}>
        <View style={styles.unlockHeaderRow}>
          <View style={styles.unlockTopIcon}>
            <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
          </View>

          <View style={styles.unlockHeaderText}>
            <Text style={styles.unlockTitle}>{tr('Staff Hours locked', 'Arbeitszeiten gesperrt')}</Text>
            <Text style={styles.unlockSub}>
              {isPinLocked
                ? tr(`Try again in ${lockRemaining}`, `Noch ${lockRemaining} warten`)
                : tr('Enter admin PIN to continue.', 'Admin-PIN eingeben zum Fortfahren.')}
            </Text>
          </View>
        </View>

        <View style={styles.pinActionRow}>
          <View style={[styles.pinInputWrap, isPinLocked && styles.inputDisabled]}>
            <Ionicons name="keypad-outline" size={17} color="#9CA3AF" />
            <TextInput
              ref={pinInputRef}
              style={styles.pinInputInline}
              placeholder={tr('PIN', 'PIN')}
              placeholderTextColor="#A8ACB7"
              value={pinInput}
              onChangeText={text => {
                const clean = text.replace(/\D/g, '').slice(0, STAFF_PIN_LENGTH);
                setPinInput(clean);
                if (pinError) setPinError('');
              }}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={STAFF_PIN_LENGTH}
              editable={!isPinLocked && !verifying}
              onSubmitEditing={() => handleVerifyPin()}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.unlockBtn, (pinInput.trim().length < STAFF_PIN_LENGTH || verifying || isPinLocked) && styles.btnDisabled]}
            onPress={() => handleVerifyPin()}
            disabled={pinInput.trim().length < STAFF_PIN_LENGTH || verifying || isPinLocked}
            activeOpacity={0.8}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.unlockBtnText}>{tr('Open', 'Öffnen')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {pinError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={RED} />
            <Text style={styles.errorText}>{pinError}</Text>
          </View>
        ) : wrongPinCount > 0 && !isPinLocked ? (
          <Text style={styles.attemptText}>
            {tr(`${attemptsLeft} attempts left`, `Noch ${attemptsLeft} Versuche`)}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderEmployeeCard = (emp: Employee) => {
    const isIn = emp.clocked_in;

    return (
      <TouchableOpacity
        key={emp.id}
        style={[styles.employeeCard, isIn && styles.employeeCardActive]}
        onPress={() => setSelectedEmployee(emp)}
        activeOpacity={0.78}
      >
        <View style={styles.employeeCardTop}>
          <Text style={styles.employeeName} numberOfLines={1}>{emp.name}</Text>

          <View style={[styles.statusPill, isIn ? styles.statusPillIn : styles.statusPillOut]}>
            <View style={[styles.statusDot, { backgroundColor: isIn ? GREEN : '#9CA3AF' }]} />
            <Text style={[styles.statusPillText, { color: isIn ? GREEN : '#6B7280' }]}>
              {isIn ? tr('In', 'Drin') : tr('Out', 'Draussen')}
            </Text>
          </View>
        </View>

        {isIn ? (
          <View style={styles.employeeMetaGrid}>
            <View style={styles.employeeMetaItem}>
              <Text style={styles.employeeMetaLabel}>{tr('Since', 'Seit')}</Text>
              <Text style={styles.employeeMetaValue}>{formatTime(emp.clock_in_time)}</Text>
            </View>
            <View style={styles.employeeMetaItem}>
              <Text style={styles.employeeMetaLabel}>{tr('Today', 'Heute')}</Text>
              <Text style={styles.employeeMetaValue}>{durationSince(emp.clock_in_time)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.employeeSub}>{tr('Tap to clock in', 'Tippen zum Einstempeln')}</Text>
        )}

        <View style={[styles.cardActionPill, isIn ? styles.cardActionPillOut : styles.cardActionPillIn]}>
          <Ionicons name={isIn ? 'log-out-outline' : 'log-in-outline'} size={16} color={isIn ? RED : GREEN} />
          <Text style={[styles.cardActionPillText, { color: isIn ? RED : GREEN }]}>
            {isIn ? tr('Clock Out', 'Ausstempeln') : tr('Clock In', 'Einstempeln')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmployees = () => (
    <View style={styles.section}>
      <View style={styles.staffHeaderCard}>
        <View style={styles.staffHeaderTop}>
          <View>
            <Text style={styles.staffKicker}>{tr('STAFF CLOCK', 'PERSONAL-UHR')}</Text>
            <Text style={styles.staffTitle}>{tr('Clock in / out', 'Ein- / Ausstempeln')}</Text>
          </View>

          <TouchableOpacity
            style={styles.lockBtn}
            onPress={() => {
              setUnlocked(false);
              setEmployees([]);
              setSelectedEmployee(null);
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="lock-closed-outline" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>{employees.length}</Text>
            <Text style={styles.summaryLabel}>{tr('Employees', 'Mitarbeiter')}</Text>
          </View>
          <View style={styles.summaryBoxGreen}>
            <Text style={[styles.summaryNumber, { color: GREEN }]}>{clockedInEmployees.length}</Text>
            <Text style={styles.summaryLabel}>{tr('Clocked in', 'Eingestempelt')}</Text>
          </View>
          <View style={styles.summaryBox}> 
            <Text style={styles.summaryNumber}>{clockedOutEmployees.length}</Text>
            <Text style={styles.summaryLabel}>{tr('Clocked out', 'Ausgestempelt')}</Text>
          </View>
        </View>

        <View style={styles.toolbarRow}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => loadEmployees(true)} activeOpacity={0.75}>
            {refreshing ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Ionicons name="refresh-outline" size={17} color={PRIMARY} />
            )}
            <Text style={styles.toolbarBtnText}>{tr('Refresh', 'Aktualisieren')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolbarBtn} onPress={() => setAddModal(true)} activeOpacity={0.75}>
            <Ionicons name="person-add-outline" size={17} color={PRIMARY} />
            <Text style={styles.toolbarBtnText}>{tr('Add', 'Hinzufügen')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolbarBtn} onPress={() => setManageModal(true)} activeOpacity={0.75}>
            <Ionicons name="settings-outline" size={17} color={PRIMARY} />
            <Text style={styles.toolbarBtnText}>{tr('Manage', 'Verwalten')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolbarBtn} onPress={() => openReport()} activeOpacity={0.75}>
            <Ionicons name="stats-chart-outline" size={17} color={PRIMARY} />
            <Text style={styles.toolbarBtnText}>{tr('Report', 'Bericht')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder={tr('Search employee...', 'Mitarbeiter suchen...')}
          placeholderTextColor="#9CA3AF"
          value={searchText}
          onChangeText={setSearchText}
          autoCorrect={false}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingInlineCard}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.loadingInlineText}>{tr('Loading employees...', 'Mitarbeiter werden geladen...')}</Text>
        </View>
      ) : employees.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="people-outline" size={34} color="#C0C4CE" />
          </View>
          <Text style={styles.emptyTitle}>{tr('No employees yet', 'Noch keine Mitarbeiter')}</Text>
          <Text style={styles.emptySub}>
            {tr('Add your first employee to start using staff clock.', 'Füge den ersten Mitarbeiter hinzu, um die Zeiterfassung zu starten.')}
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setAddModal(true)} activeOpacity={0.8}>
            <Ionicons name="person-add-outline" size={17} color="#fff" />
            <Text style={styles.emptyAddBtnText}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredEmployees.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="search-outline" size={34} color="#C0C4CE" />
          <Text style={styles.emptyTitle}>{tr('No match found', 'Kein Treffer gefunden')}</Text>
          <Text style={styles.emptySub}>{tr('Try a different name.', 'Versuche einen anderen Namen.')}</Text>
        </View>
      ) : (
        <View style={styles.employeeList}>
          {filteredEmployees.map(renderEmployeeCard)}
        </View>
      )}
    </View>
  );

  return (
    <>
      {unlocked ? renderEmployees() : renderPinGate()}

      {/* Employee action popup */}
      <Modal visible={!!selectedCurrent} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedEmployee(null)}>
          <TouchableOpacity style={styles.actionModalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            {selectedCurrent ? (
              <>
                <View style={styles.actionModalHeader}>
                  <View style={styles.actionModalTitleWrap}>
                    <View style={styles.actionTitleLine}>
                      <Text style={styles.actionModalName} numberOfLines={1}>{selectedCurrent.name}</Text>
                      <View style={[styles.statusPill, selectedCurrent.clocked_in ? styles.statusPillIn : styles.statusPillOut]}>
                        <View style={[styles.statusDot, { backgroundColor: selectedCurrent.clocked_in ? GREEN : '#9CA3AF' }]} />
                        <Text style={[styles.statusPillText, { color: selectedCurrent.clocked_in ? GREEN : '#6B7280' }]}>
                          {selectedCurrent.clocked_in ? tr('In', 'Drin') : tr('Out', 'Draussen')}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.actionModalStatus, { color: selectedCurrent.clocked_in ? GREEN : MUTED }]}> 
                      {selectedCurrent.clocked_in
                        ? tr(
                            `Clocked in since ${formatTime(selectedCurrent.clock_in_time)}`,
                            `Eingestempelt seit ${formatTime(selectedCurrent.clock_in_time)}`
                          )
                        : tr('Currently clocked out', 'Aktuell ausgestempelt')}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={() => setSelectedEmployee(null)} style={styles.modalCloseBtn} activeOpacity={0.75}>
                    <Ionicons name="close" size={18} color="#5B5F6B" />
                  </TouchableOpacity>
                </View>

                {selectedCurrent.clocked_in ? (
                  <View style={styles.currentShiftBox}>
                    <View style={styles.currentShiftItem}>
                      <Text style={styles.currentShiftLabel}>{tr('Clock in', 'Eingestempelt')}</Text>
                      <Text style={styles.currentShiftValue}>{formatTime(selectedCurrent.clock_in_time)}</Text>
                    </View>
                    <View style={styles.currentShiftDivider} />
                    <View style={styles.currentShiftItem}>
                      <Text style={styles.currentShiftLabel}>{tr('Duration', 'Dauer')}</Text>
                      <Text style={styles.currentShiftValue}>{durationSince(selectedCurrent.clock_in_time)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.actionHint}>
                    {tr('Tap clock in when this employee starts working.', 'Tippe auf Einstempeln, wenn dieser Mitarbeiter anfängt zu arbeiten.')}
                  </Text>
                )}

                {selectedCurrent.clocked_in ? (
                  <TouchableOpacity
                    style={styles.adjustTimeBtn}
                    onPress={() => openAdjustShift({
                      employee_id: selectedCurrent.id,
                      name: selectedCurrent.name,
                      clock_in: selectedCurrent.clock_in_time || new Date().toISOString(),
                      clock_out: null,
                    })}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="create-outline" size={16} color={PRIMARY} />
                    <Text style={styles.adjustTimeBtnText}>{tr('Adjust clock-in time', 'Einstempelzeit anpassen')}</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.bigClockBtn, selectedCurrent.clocked_in ? styles.bigClockBtnOut : styles.bigClockBtnIn]}
                    onPress={() => handleToggleClock(selectedCurrent)}
                    disabled={clockLoadingId === selectedCurrent.id}
                    activeOpacity={0.82}
                  >
                    {clockLoadingId === selectedCurrent.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name={selectedCurrent.clocked_in ? 'log-out-outline' : 'log-in-outline'}
                          size={22}
                          color="#fff"
                        />
                        <Text style={styles.bigClockBtnText}>
                          {selectedCurrent.clocked_in ? tr('Clock Out', 'Ausstempeln') : tr('Clock In', 'Einstempeln')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


      {/* Manage employees */}
      <Modal visible={manageModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setManageModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{tr('Manage employees', 'Mitarbeiter verwalten')}</Text>
                <Text style={styles.modalSubTitle}>{tr('Remove employees only from here.', 'Mitarbeiter nur hier entfernen.')}</Text>
              </View>
              <TouchableOpacity onPress={() => setManageModal(false)} style={styles.modalCloseBtn} activeOpacity={0.75}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.manageList}>
              {employees.length === 0 ? (
                <Text style={styles.manageEmptyText}>{tr('No employees yet', 'Noch keine Mitarbeiter')}</Text>
              ) : (
                employees.map(employee => (
                  <View key={employee.id} style={styles.manageRow}>
                    <View style={[styles.manageAvatar, employee.clocked_in ? styles.avatarIn : styles.avatarOut]}>
                      <Text style={[styles.manageAvatarText, employee.clocked_in ? styles.avatarTextIn : styles.avatarTextOut]}>
                        {initials(employee.name)}
                      </Text>
                    </View>

                    <View style={styles.manageInfo}>
                      <Text style={styles.manageName} numberOfLines={1}>{employee.name}</Text>
                      <Text style={[styles.manageStatus, { color: employee.clocked_in ? GREEN : MUTED }]}>
                        {employee.clocked_in ? tr('Clocked in', 'Eingestempelt') : tr('Clocked out', 'Ausgestempelt')}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.manageRemoveBtn}
                      onPress={() => requestDeactivate(employee)}
                      disabled={deleteLoadingId === employee.id}
                      activeOpacity={0.75}
                    >
                      {deleteLoadingId === employee.id ? (
                        <ActivityIndicator color={RED} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={RED} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add employee */}
      <Modal visible={addModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAddModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
                <Text style={styles.modalSubTitle}>{tr('Create a new staff card.', 'Neue Mitarbeiterkarte erstellen.')}</Text>
              </View>
              <TouchableOpacity onPress={() => setAddModal(false)} style={styles.modalCloseBtn} activeOpacity={0.75}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>{tr('Employee name', 'Name des Mitarbeiters')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={tr('e.g. Sara', 'z.B. Sara')}
                placeholderTextColor="#A8ACB7"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAddEmployee}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, (!newName.trim() || adding) && styles.btnDisabled]}
                onPress={handleAddEmployee}
                disabled={!newName.trim() || adding}
                activeOpacity={0.8}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Monthly report */}
      <Modal visible={reportModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReportModal(false)}>
          <TouchableOpacity style={[styles.modalBox, styles.reportBox]} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{tr('Monthly Report', 'Monatsbericht')}</Text>
                <Text style={styles.modalSubTitle}>{monthLabel(reportMonth, isGerman)}</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModal(false)} style={styles.modalCloseBtn} activeOpacity={0.75}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.monthNav}>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() => openReport(currentMonthString(monthOffset(reportMonth) - 1))}
                activeOpacity={0.75}
              >
                <Ionicons name="chevron-back" size={20} color={PRIMARY} />
              </TouchableOpacity>

              <Text style={styles.monthLabel}>{monthLabel(reportMonth, isGerman)}</Text>

              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() => openReport(currentMonthString(monthOffset(reportMonth) + 1))}
                activeOpacity={0.75}
              >
                <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.printReportBtn, (reportLoading || reportData.length === 0 || reportPrinting) && styles.btnDisabled]}
              onPress={handlePrintReport}
              disabled={reportLoading || reportData.length === 0 || reportPrinting}
              activeOpacity={0.78}
            >
              {reportPrinting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="print-outline" size={16} color="#fff" />
                  <Text style={styles.printReportBtnText}>{tr('Print report', 'Bericht drucken')}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.reportSummaryRow}>
              <View style={styles.reportSummaryCard}>
                <Text style={styles.reportSummaryValue}>{reportData.length}</Text>
                <Text style={styles.reportSummaryLabel}>{tr('Employees', 'Mitarbeiter')}</Text>
              </View>
              <View style={styles.reportSummaryCard}>
                <Text style={styles.reportSummaryValue}>{formatHours(totalReportHours)}</Text>
                <Text style={styles.reportSummaryLabel}>{tr('Total hours', 'Stunden gesamt')}</Text>
              </View>
            </View>

            <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportScrollContent}>
              {reportLoading ? (
                <View style={styles.reportLoadingBox}>
                  <ActivityIndicator color={PRIMARY} />
                  <Text style={styles.loadingInlineText}>{tr('Loading report...', 'Bericht wird geladen...')}</Text>
                </View>
              ) : reportData.length === 0 ? (
                <View style={styles.reportEmptyBox}>
                  <Ionicons name="calendar-clear-outline" size={36} color="#C0C4CE" />
                  <Text style={styles.emptyTitle}>{tr('No data for this month', 'Keine Daten für diesen Monat')}</Text>
                </View>
              ) : (
                reportData.map(row => {
                  const isExpanded = expandedRow === row.employee_id;

                  return (
                    <View key={row.employee_id} style={styles.reportEmployeeCard}>
                      <TouchableOpacity
                        style={styles.reportEmployeeHeader}
                        onPress={() => setExpandedRow(isExpanded ? null : row.employee_id)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.reportAvatar}>
                          <Text style={styles.reportAvatarText}>{initials(row.name)}</Text>
                        </View>

                        <View style={styles.reportEmployeeInfo}>
                          <Text style={styles.reportEmployeeName} numberOfLines={1}>{row.name}</Text>
                          <Text style={styles.reportEmployeeSub}>
                            {row.shifts.length} {row.shifts.length === 1 ? tr('shift', 'Schicht') : tr('shifts', 'Schichten')}
                          </Text>
                        </View>

                        <Text style={styles.reportHours}>{formatHours(row.total_hours)}</Text>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                      </TouchableOpacity>

                      {isExpanded ? (
                        <View style={styles.shiftList}>
                          {row.shifts.map((shift, i) => (
                            <View key={`${shift.clock_in}-${i}`} style={styles.shiftRow}>
                              <View style={styles.shiftDateBox}>
                                <Text style={styles.shiftDateText}>{formatDate(shift.clock_in, isGerman)}</Text>
                              </View>

                              <View style={styles.shiftTimeBox}>
                                <Text style={styles.shiftTimeText}>
                                  {formatTime(shift.clock_in)} → {shift.clock_out ? formatTime(shift.clock_out) : tr('now', 'jetzt')}
                                </Text>
                                <Text style={styles.shiftDurationText}>{durationBetween(shift.clock_in, shift.clock_out)}</Text>
                              </View>

                              <TouchableOpacity
                                style={styles.shiftEditBtn}
                                onPress={() => openAdjustShift({
                                  employee_id: row.employee_id,
                                  name: row.name,
                                  clock_in: shift.clock_in,
                                  clock_out: shift.clock_out,
                                  shift_index: i,
                                })}
                                activeOpacity={0.75}
                              >
                                <Ionicons name="create-outline" size={15} color={PRIMARY} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Adjust time */}
      <Modal visible={adjustModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeAdjustModal}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{tr('Adjust time', 'Zeit anpassen')}</Text>
                <Text style={styles.modalSubTitle}>{adjustShift?.name || ''}</Text>
              </View>
              <TouchableOpacity onPress={closeAdjustModal} style={styles.modalCloseBtn} activeOpacity={0.75}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.adjustHelpText}>
                {tr(
                  'Use this only when someone forgot to clock in/out or tapped by mistake.',
                  'Nur benutzen, wenn jemand das Ein-/Ausstempeln vergessen oder falsch getippt hat.'
                )}
              </Text>

              <Text style={styles.fieldLabel}>{tr('Clock in', 'Einstempeln')}</Text>
              <View style={styles.adjustInputRow}>
                <TouchableOpacity
                  style={[styles.dateSelectBtn, styles.adjustDateInput]}
                  onPress={() => openAdjustDatePicker('in')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
                  <Text style={styles.dateSelectText}>{adjustInDate || 'YYYY-MM-DD'}</Text>
                </TouchableOpacity>

                <View style={[styles.timeStepperWrap, styles.adjustTimeInput]}>
                  <TextInput
                    style={styles.timeStepperInput}
                    placeholder="HH:MM"
                    placeholderTextColor="#A8ACB7"
                    value={adjustInTime}
                    onChangeText={setAdjustInTime}
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                  />
                  <View style={styles.timeStepperButtons}>
                    <TouchableOpacity style={styles.timeStepperBtn} onPress={() => changeAdjustTime('in', 10)} activeOpacity={0.75}>
                      <Ionicons name="chevron-up" size={16} color={PRIMARY} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timeStepperBtn} onPress={() => changeAdjustTime('in', -10)} activeOpacity={0.75}>
                      <Ionicons name="chevron-down" size={16} color={PRIMARY} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {adjustShift?.clock_out ? (
                <>
                  <Text style={styles.fieldLabel}>{tr('Clock out', 'Ausstempeln')}</Text>
                  <View style={styles.adjustInputRow}>
                    <TouchableOpacity
                      style={[styles.dateSelectBtn, styles.adjustDateInput]}
                      onPress={() => openAdjustDatePicker('out')}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
                      <Text style={styles.dateSelectText}>{adjustOutDate || 'YYYY-MM-DD'}</Text>
                    </TouchableOpacity>

                    <View style={[styles.timeStepperWrap, styles.adjustTimeInput]}>
                      <TextInput
                        style={styles.timeStepperInput}
                        placeholder="HH:MM"
                        placeholderTextColor="#A8ACB7"
                        value={adjustOutTime}
                        onChangeText={setAdjustOutTime}
                        autoCorrect={false}
                        keyboardType="numbers-and-punctuation"
                      />
                      <View style={styles.timeStepperButtons}>
                        <TouchableOpacity style={styles.timeStepperBtn} onPress={() => changeAdjustTime('out', 10)} activeOpacity={0.75}>
                          <Ionicons name="chevron-up" size={16} color={PRIMARY} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timeStepperBtn} onPress={() => changeAdjustTime('out', -10)} activeOpacity={0.75}>
                          <Ionicons name="chevron-down" size={16} color={PRIMARY} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.adjustOpenShiftNote}>
                  {tr('This is an open shift. Only the clock-in time can be adjusted until the employee clocks out.', 'Dies ist eine offene Schicht. Bis zum Ausstempeln kann nur die Einstempelzeit angepasst werden.')}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, styles.adjustSaveBtn, adjustSaving && styles.btnDisabled]}
                onPress={handleSaveAdjustedShift}
                disabled={adjustSaving}
                activeOpacity={0.8}
              >
                {adjustSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>{tr('Save time', 'Zeit speichern')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date picker */}
      <Modal visible={!!datePickerTarget} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDatePickerTarget(null)}>
          <TouchableOpacity style={styles.calendarBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.calendarNavBtn}
                onPress={() => setDatePickerMonth(value => shiftMonthInput(value, -1))}
                activeOpacity={0.75}
              >
                <Ionicons name="chevron-back" size={18} color={PRIMARY} />
              </TouchableOpacity>

              <Text style={styles.calendarTitle}>{calendarMonthTitle(datePickerMonth, isGerman)}</Text>

              <TouchableOpacity
                style={styles.calendarNavBtn}
                onPress={() => setDatePickerMonth(value => shiftMonthInput(value, 1))}
                activeOpacity={0.75}
              >
                <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekRow}>
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <Text key={day} style={styles.calendarWeekText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays(datePickerMonth).map((dateValue, index) => {
                const selectedValue = datePickerTarget === 'in' ? adjustInDate : adjustOutDate;
                const selected = !!dateValue && dateValue === selectedValue;

                return (
                  <TouchableOpacity
                    key={`${dateValue || 'blank'}-${index}`}
                    style={[styles.calendarDayBtn, selected && styles.calendarDayBtnActive]}
                    onPress={() => dateValue && selectAdjustDate(dateValue)}
                    disabled={!dateValue}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.calendarDayText, selected && styles.calendarDayTextActive]}>
                      {dateValue ? String(parseDateInput(dateValue)?.getDate() || '') : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.calendarCancelBtn} onPress={() => setDatePickerTarget(null)} activeOpacity={0.75}>
              <Text style={styles.calendarCancelText}>{tr('Cancel', 'Abbrechen')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },

  sectionHeader: {
    marginBottom: 8,
    paddingHorizontal: 3,
  },

  sectionTitle: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#555B66',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  unlockCard: {
    width: 500,
    alignSelf: 'flex-start',
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 10,
  },

  unlockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  unlockTopIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  unlockHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  unlockTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  unlockSub: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    lineHeight: 18,
    fontFamily: appFont,
  },

  pinActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  pinInputWrap: {
    flex: 1,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    backgroundColor: '#FAFAFB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },

  inputDisabled: {
    backgroundColor: '#F2F3F7',
    opacity: 0.7,
  },

  pinInputInline: {
    flex: 1,
    fontSize: fontSizes.lg,
    color: TEXT,
    fontFamily: appFont,
    fontWeight: fontWeights.extrabold,
    padding: 0,
  },

  errorBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  errorText: {
    flex: 1,
    color: RED,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  attemptText: {
    marginTop: 8,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
    textAlign: 'right',
  },

  unlockBtn: {
    minWidth: 92,
    height: 44,
    backgroundColor: PRIMARY,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  unlockBtnText: {
    color: '#fff',
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  staffHeaderCard: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },

  staffHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  staffKicker: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    letterSpacing: 0.8,
    fontFamily: appFont,
  },

  staffTitle: {
    marginTop: 2,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  lockBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: '#F7F8FA',
    borderWidth: thinBorder,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  summaryBox: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    paddingVertical: 11,
    paddingHorizontal: 9,
    alignItems: 'center',
  },

  summaryBoxGreen: {
    flex: 1,
    backgroundColor: colors.successSoft,
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: '#BBF7D0',
    paddingVertical: 11,
    paddingHorizontal: 9,
    alignItems: 'center',
  },

  summaryNumber: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  summaryLabel: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
    textAlign: 'center',
  },

  toolbarRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 13,
  },

  toolbarBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },

  toolbarBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: PRIMARY,
    fontFamily: appFont,
  },

  searchWrap: {
    height: 48,
    backgroundColor: CARD_BG,
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 9,
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: fontSizes.mdl,
    color: TEXT,
    fontFamily: appFont,
    fontWeight: fontWeights.semibold,
    padding: 0,
  },

  clearSearchBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  employeeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  employeeCard: {
    width: '31.8%',
    minHeight: 142,
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 12,
    justifyContent: 'space-between',
    gap: 9,
  },

  employeeCardActive: {
    borderColor: '#BBF7D0',
    backgroundColor: '#FBFFFC',
  },

  employeeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarIn: {
    backgroundColor: colors.successSoft,
  },

  avatarOut: {
    backgroundColor: PRIMARY_SOFT,
  },

  avatarText: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  avatarTextIn: {
    color: GREEN,
  },

  avatarTextOut: {
    color: PRIMARY,
  },

  employeeInfo: {
    flex: 1,
    minWidth: 0,
  },

  employeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  employeeName: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  statusPill: {
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  statusPillIn: {
    backgroundColor: colors.successSoft,
  },

  statusPillOut: {
    backgroundColor: '#F2F3F7',
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
  },

  statusPillText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  employeeMetaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },

  employeeMetaItem: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    borderRadius: radii.mdl,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  employeeMetaLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
  },

  employeeMetaValue: {
    marginTop: 1,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  employeeSub: {
    marginTop: 4,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    fontFamily: appFont,
  },

  cardActionIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardActionIconIn: {
    backgroundColor: colors.successSoft,
  },

  cardActionIconOut: {
    backgroundColor: colors.dangerSoft,
  },

  cardActionPill: {
    minHeight: 36,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  cardActionPillIn: {
    backgroundColor: colors.successSoft,
  },

  cardActionPillOut: {
    backgroundColor: colors.dangerSoft,
  },

  cardActionPillText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  loadingInlineCard: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
  },

  loadingInlineText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    fontFamily: appFont,
  },

  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
  },

  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: '#F2F3F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
    textAlign: 'center',
  },

  emptySub: {
    marginTop: 6,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: appFont,
  },

  emptyAddBtn: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: radii.lgl,
    paddingHorizontal: 16,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  emptyAddBtnText: {
    color: '#fff',
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },

  modalBox: {
    backgroundColor: '#fff',
    borderRadius: radii.massive,
    width: '92%',
    maxWidth: 450,
    overflow: 'hidden',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  actionModalBox: {
    backgroundColor: '#fff',
    borderRadius: radii.massive,
    width: '92%',
    maxWidth: 460,
    overflow: 'hidden',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },

  actionTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  adjustTimeBtn: {
    marginHorizontal: 18,
    marginTop: 0,
    marginBottom: 12,
    minHeight: 42,
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    backgroundColor: '#FAFAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  adjustTimeBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: PRIMARY,
    fontFamily: appFont,
  },

  avatarLarge: {
    width: 58,
    height: 58,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarLargeText: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  actionModalTitleWrap: {
    flex: 1,
    minWidth: 0,
  },

  actionModalName: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  actionModalStatus: {
    marginTop: 3,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  currentShiftBox: {
    margin: 18,
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    backgroundColor: '#FAFAFB',
    flexDirection: 'row',
    overflow: 'hidden',
  },

  currentShiftItem: {
    flex: 1,
    padding: 13,
    alignItems: 'center',
  },

  currentShiftDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },

  currentShiftLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
  },

  currentShiftValue: {
    marginTop: 3,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  actionHint: {
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 2,
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.semibold,
    lineHeight: 20,
    color: SOFT_TEXT,
    fontFamily: appFont,
    textAlign: 'center',
  },

  actionButtons: {
    padding: 18,
    gap: 10,
  },

  bigClockBtn: {
    minHeight: 54,
    borderRadius: radii.lgl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  bigClockBtnIn: {
    backgroundColor: GREEN,
  },

  bigClockBtnOut: {
    backgroundColor: RED,
  },

  bigClockBtnText: {
    color: '#fff',
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  removeBtn: {
    minHeight: 46,
    borderRadius: radii.lgl,
    backgroundColor: '#FEF2F2',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  removeBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: RED,
    fontFamily: appFont,
  },

  manageList: {
    maxHeight: 420,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  manageEmptyText: {
    paddingVertical: 24,
    textAlign: 'center',
    color: MUTED,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F1F5',
  },

  manageAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  manageAvatarText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  manageInfo: {
    flex: 1,
    minWidth: 0,
  },

  manageName: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  manageStatus: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  manageRemoveBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 14,
  },

  modalTitle: {
    marginTop: 3,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  modalSubTitle: {
    marginTop: 3,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    fontFamily: appFont,
  },

  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  modalBody: {
    padding: 18,
  },

  fieldLabel: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: '#555B66',
    marginBottom: 7,
    fontFamily: appFont,
  },

  textInput: {
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lg,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: fontSizes.lg,
    color: TEXT,
    backgroundColor: '#FAFAFB',
    fontFamily: appFont,
    fontWeight: fontWeights.semibold,
    marginBottom: 14,
  },

  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: radii.lgl,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  btnDisabled: {
    backgroundColor: '#C7CBD4',
  },

  primaryBtnText: {
    color: '#fff',
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  reportBox: {
    maxWidth: 560,
    maxHeight: '86%',
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },

  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthLabel: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
    textAlign: 'center',
  },

  reportSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },

  reportSummaryCard: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 12,
    alignItems: 'center',
  },

  reportSummaryValue: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  reportSummaryLabel: {
    marginTop: 3,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
    textAlign: 'center',
  },

  printReportBtn: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 0,
    minHeight: 42,
    borderRadius: radii.lgl,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  printReportBtnText: {
    color: '#fff',
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  reportScroll: {
    maxHeight: 430,
  },

  reportScrollContent: {
    padding: 14,
    gap: 10,
  },

  reportLoadingBox: {
    paddingVertical: 34,
    alignItems: 'center',
    gap: 10,
  },

  reportEmptyBox: {
    paddingVertical: 34,
    alignItems: 'center',
    gap: 10,
  },

  reportEmployeeCard: {
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  reportEmployeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },

  reportAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reportAvatarText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  reportEmployeeInfo: {
    flex: 1,
    minWidth: 0,
  },

  reportEmployeeName: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  reportEmployeeSub: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
  },

  reportHours: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  shiftList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    padding: 10,
    gap: 8,
    backgroundColor: '#fff',
  },

  shiftRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },

  shiftDateBox: {
    borderRadius: radii.mdl,
    backgroundColor: '#F2F3F7',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  shiftDateText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    color: '#555B66',
    fontFamily: appFont,
  },

  shiftTimeBox: {
    flex: 1,
    minWidth: 0,
  },

  shiftTimeText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: TEXT,
    fontFamily: appFont,
  },

  shiftDurationText: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
  },

  shiftEditBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: thinBorder,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  adjustHelpText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    lineHeight: 18,
    fontFamily: appFont,
    marginBottom: 12,
  },

  adjustInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },

  adjustDateInput: {
    flex: 1.35,
    marginBottom: 0,
  },

  adjustTimeInput: {
    flex: 0.9,
    marginBottom: 0,
  },

  dateSelectBtn: {
    minHeight: 46,
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  dateSelectText: {
    flex: 1,
    fontSize: fontSizes.mdl,
    color: TEXT,
    fontFamily: appFont,
    fontWeight: fontWeights.semibold,
  },

  timeStepperWrap: {
    minHeight: 46,
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lg,
    backgroundColor: '#FAFAFB',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },

  timeStepperInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: fontSizes.mdl,
    color: TEXT,
    fontFamily: appFont,
    fontWeight: fontWeights.semibold,
  },

  timeStepperButtons: {
    width: 34,
    alignSelf: 'stretch',
    borderLeftWidth: thinBorder,
    borderLeftColor: BORDER,
  },

  timeStepperBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  adjustSaveBtn: {
    marginTop: 16,
  },

  adjustOpenShiftNote: {
    marginTop: 12,
    marginBottom: 4,
    padding: 10,
    borderRadius: radii.lg,
    backgroundColor: '#FFFBEB',
    borderWidth: thinBorder,
    borderColor: '#FDE68A',
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: '#92400E',
    lineHeight: 18,
    fontFamily: appFont,
  },

  calendarBox: {
    width: '92%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: radii.massive,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 14,
  },

  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  calendarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: thinBorder,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },

  calendarWeekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.extrabold,
    color: MUTED,
    fontFamily: appFont,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  calendarDayBtn: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.mdl,
  },

  calendarDayBtnActive: {
    backgroundColor: PRIMARY,
  },

  calendarDayText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: TEXT,
    fontFamily: appFont,
  },

  calendarDayTextActive: {
    color: '#fff',
    fontWeight: fontWeights.extrabold,
  },

  calendarCancelBtn: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: radii.lgl,
    backgroundColor: '#F3F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarCancelText: {
    color: '#555B66',
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

});
