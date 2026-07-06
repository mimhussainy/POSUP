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

const PRIMARY = colors.primary;
const PRIMARY_SOFT = colors.primarySoft;
const CARD_BG = colors.cardBg;
const BORDER = colors.borderStrong;
const TEXT = colors.text;
const MUTED = colors.muted;
const GREEN = colors.success;
const RED = colors.danger;
const ORANGE = colors.warning;
const thinBorder = borders.thin;

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

function safeDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(iso?: string | null) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso?: string | null, isGerman: boolean = true) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(isGerman ? 'de-CH' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatHours(h: number) {
  if (!Number.isFinite(h) || h <= 0) return '0h 0m';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function minutesBetween(startIso?: string | null, endIso?: string | null, now: Date = new Date()) {
  const start = safeDate(startIso);
  const end = endIso ? safeDate(endIso) : now;
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function formatMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hrs = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hrs}h ${mins}m`;
}

function formatShiftDuration(shift: ReportShift, now: Date) {
  return formatMinutes(minutesBetween(shift.clock_in, shift.clock_out, now));
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

function sortEmployees(list: Employee[]) {
  return [...list].sort((a, b) => {
    if (a.clocked_in !== b.clocked_in) return a.clocked_in ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function getErrorMessage(e: any, fallback: string) {
  return String(e?.message || e?.error || fallback);
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

  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState('');

  const pinInputRef = useRef<TextInput>(null);

  const [mainModal, setMainModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [clockingEmployeeId, setClockingEmployeeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [reportModal, setReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(currentMonthString());
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!pinModal) return undefined;
    const timer = setTimeout(() => pinInputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [pinModal]);

  useEffect(() => {
    if (!mainModal && !selectedEmployeeId && !reportModal) return undefined;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [mainModal, selectedEmployeeId, reportModal]);

  const clockedInEmployees = useMemo(
    () => employees.filter(emp => emp.clocked_in),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = sortEmployees(employees);
    if (!q) return sorted;
    return sorted.filter(emp => emp.name.toLowerCase().includes(q));
  }, [employees, search]);

  const selectedEmployee = useMemo(
    () => employees.find(emp => emp.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const reportTotalHours = useMemo(
    () => reportData.reduce((sum, row) => sum + (Number(row.total_hours) || 0), 0),
    [reportData]
  );

  const reportShiftCount = useMemo(
    () => reportData.reduce((sum, row) => sum + (row.shifts?.length || 0), 0),
    [reportData]
  );

  const loadEmployees = useCallback(async (): Promise<Employee[]> => {
    if (!restaurantCode) {
      setEmployees([]);
      setLoadError(tr('Restaurant code missing', 'Restaurant-Code fehlt'));
      return [];
    }

    setLoading(true);
    setLoadError('');

    try {
      const res = await fetchStaffEmployees(restaurantCode);
      if (res.success) {
        const nextEmployees = Array.isArray(res.employees) ? res.employees : [];
        setEmployees(nextEmployees);
        return nextEmployees;
      }

      setLoadError((res as any)?.error || tr('Could not load employees', 'Mitarbeiter konnten nicht geladen werden'));
      return [];
    } catch (e) {
      setLoadError(getErrorMessage(e, tr('Could not load employees', 'Mitarbeiter konnten nicht geladen werden')));
      return [];
    } finally {
      setLoading(false);
    }
  }, [restaurantCode, isGerman]);

  const openPinModal = () => {
    setPinInput('');
    setPinError('');
    setPinModal(true);
  };

  const handleVerifyPin = async () => {
    const pin = pinInput.trim();

    if (!pin) {
      setPinError(tr('Enter your admin PIN', 'Admin-PIN eingeben'));
      return;
    }

    if (!restaurantCode) {
      setPinError(tr('Restaurant code missing', 'Restaurant-Code fehlt'));
      return;
    }

    setVerifying(true);
    setPinError('');

    try {
      const res = await verifyAdminPin(restaurantCode, pin);
      if (res.success) {
        setPinModal(false);
        setMainModal(true);
        setSearch('');
        setSelectedEmployeeId(null);
        await loadEmployees();
      } else {
        setPinError((res as any)?.error || tr('Incorrect PIN', 'Falsche PIN'));
      }
    } catch (e) {
      setPinError(getErrorMessage(e, tr('Could not verify PIN', 'PIN konnte nicht geprüft werden')));
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleClock = async (employee: Employee) => {
    if (!restaurantCode || clockingEmployeeId) return;

    setClockingEmployeeId(employee.id);
    setActionError('');

    try {
      await toggleStaffClock(employee.id, restaurantCode);
      await loadEmployees();
    } catch (e) {
      setActionError(getErrorMessage(e, tr('Clock action failed', 'Stempelaktion fehlgeschlagen')));
    } finally {
      setClockingEmployeeId(null);
    }
  };

  const handleAddEmployee = async () => {
    const name = newName.trim();

    if (!name) {
      setAddError(tr('Enter employee name', 'Mitarbeiternamen eingeben'));
      return;
    }

    if (!restaurantCode) {
      setAddError(tr('Restaurant code missing', 'Restaurant-Code fehlt'));
      return;
    }

    setAdding(true);
    setAddError('');

    try {
      const res = await addStaffEmployee(restaurantCode, name);
      if (res.success) {
        setNewName('');
        setAddModal(false);
        await loadEmployees();
      } else {
        setAddError((res as any)?.error || tr('Could not add employee', 'Mitarbeiter konnte nicht hinzugefügt werden'));
      }
    } catch (e) {
      setAddError(getErrorMessage(e, tr('Could not add employee', 'Mitarbeiter konnte nicht hinzugefügt werden')));
    } finally {
      setAdding(false);
    }
  };

  const handleDeactivate = (employee: Employee) => {
    Alert.alert(
      tr('Remove employee?', 'Mitarbeiter entfernen?'),
      tr(
        `${employee.name} will be hidden from the active staff list. Existing reports stay saved.`,
        `${employee.name} wird aus der aktiven Mitarbeiterliste entfernt. Bestehende Berichte bleiben gespeichert.`
      ),
      [
        { text: tr('Cancel', 'Abbrechen'), style: 'cancel' },
        {
          text: tr('Remove', 'Entfernen'),
          style: 'destructive',
          onPress: async () => {
            setClockingEmployeeId(employee.id);
            setActionError('');

            try {
              await deactivateStaffEmployee(employee.id);
              setSelectedEmployeeId(null);
              await loadEmployees();
            } catch (e) {
              setActionError(getErrorMessage(e, tr('Could not remove employee', 'Mitarbeiter konnte nicht entfernt werden')));
            } finally {
              setClockingEmployeeId(null);
            }
          },
        },
      ]
    );
  };

  const openReport = async (month: string = reportMonth) => {
    if (!restaurantCode) {
      setReportError(tr('Restaurant code missing', 'Restaurant-Code fehlt'));
      setReportModal(true);
      return;
    }

    setReportMonth(month);
    setReportLoading(true);
    setReportError('');
    setExpandedRow(null);
    setReportModal(true);

    try {
      const res = await fetchStaffReport(restaurantCode, month);
      if (res.success) {
        setReportData(Array.isArray(res.report) ? res.report : []);
      } else {
        setReportData([]);
        setReportError((res as any)?.error || tr('Could not load report', 'Bericht konnte nicht geladen werden'));
      }
    } catch (e) {
      setReportData([]);
      setReportError(getErrorMessage(e, tr('Could not load report', 'Bericht konnte nicht geladen werden')));
    } finally {
      setReportLoading(false);
    }
  };

  const closeAll = () => {
    setMainModal(false);
    setReportModal(false);
    setAddModal(false);
    setSelectedEmployeeId(null);
    setActionError('');
  };

  const renderEmployeeCard = (emp: Employee) => {
    const isBusy = clockingEmployeeId === emp.id;
    const shiftMinutes = emp.clocked_in ? minutesBetween(emp.clock_in_time, null, now) : 0;

    return (
      <TouchableOpacity
        key={emp.id}
        style={[styles.employeeCard, emp.clocked_in && styles.employeeCardActive]}
        activeOpacity={0.78}
        onPress={() => {
          setActionError('');
          setSelectedEmployeeId(emp.id);
        }}
      >
        <View style={styles.employeeTopRow}>
          <View style={[styles.avatar, emp.clocked_in && styles.avatarActive]}>
            <Text style={[styles.avatarText, emp.clocked_in && styles.avatarTextActive]}>
              {initials(emp.name)}
            </Text>
          </View>

          <View style={[styles.statusPill, emp.clocked_in ? styles.statusPillIn : styles.statusPillOut]}>
            <View style={[styles.statusDot, { backgroundColor: emp.clocked_in ? GREEN : '#9CA3AF' }]} />
            <Text style={[styles.statusPillText, { color: emp.clocked_in ? GREEN : '#6B7280' }]}>
              {emp.clocked_in ? tr('IN', 'DRIN') : tr('OUT', 'RAUS')}
            </Text>
          </View>
        </View>

        <Text style={styles.employeeName} numberOfLines={1}>{emp.name}</Text>

        {emp.clocked_in ? (
          <>
            <Text style={styles.employeeMeta} numberOfLines={1}>
              {tr('Since', 'Seit')} {formatTime(emp.clock_in_time)}
            </Text>
            <Text style={styles.employeeDuration}>{formatMinutes(shiftMinutes)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.employeeMeta} numberOfLines={1}>
              {tr('Ready to clock in', 'Bereit zum Einstempeln')}
            </Text>
            <Text style={styles.employeeDurationMuted}>—</Text>
          </>
        )}

        <View style={styles.employeeCardFooter}>
          {isBusy ? (
            <ActivityIndicator color={emp.clocked_in ? RED : GREEN} />
          ) : (
            <>
              <Text style={[styles.employeeActionHint, { color: emp.clocked_in ? RED : GREEN }]}>
                {emp.clocked_in ? tr('Clock out', 'Ausstempeln') : tr('Clock in', 'Einstempeln')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={emp.clocked_in ? RED : GREEN} />
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr('STAFF', 'PERSONAL')}</Text>
      </View>

      <TouchableOpacity style={styles.entryCard} activeOpacity={0.78} onPress={openPinModal}>
        <View style={styles.entryIconBox}>
          <Ionicons name="people-outline" size={21} color={PRIMARY} />
        </View>

        <View style={styles.entryText}>
          <Text style={styles.entryTitle}>{tr('Staff Hours', 'Arbeitszeiten')}</Text>
          <Text style={styles.entrySub}>{tr('Employee clock in / clock out', 'Mitarbeiter ein- und ausstempeln')}</Text>
        </View>

        <View style={styles.entryRight}>
          <View style={styles.lockPill}>
            <Ionicons name="lock-closed-outline" size={13} color={PRIMARY} />
            <Text style={styles.lockPillText}>{tr('PIN', 'PIN')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C0C4CE" />
        </View>
      </TouchableOpacity>

      <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPinModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={PRIMARY} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>{tr('Admin PIN', 'Admin-PIN')}</Text>
                  <Text style={styles.modalSub}>{tr('Unlock staff time tracking', 'Arbeitszeiten entsperren')}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setPinModal(false)} style={styles.closeBtn} activeOpacity={0.75}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>{tr('PIN code', 'PIN-Code')}</Text>
              <TextInput
                ref={pinInputRef}
                style={styles.textInput}
                placeholder={tr('Enter admin PIN', 'Admin-PIN eingeben')}
                placeholderTextColor="#A8ACB7"
                value={pinInput}
                onChangeText={setPinInput}
                secureTextEntry
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleVerifyPin}
              />

              {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, verifying && styles.btnDisabled]}
                onPress={handleVerifyPin}
                disabled={verifying}
                activeOpacity={0.8}
              >
                {verifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{tr('Unlock', 'Entsperren')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={mainModal} transparent animationType="fade" onRequestClose={closeAll}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeAll}>
          <TouchableOpacity style={[styles.modalBox, styles.staffModalBox]} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="time-outline" size={20} color={PRIMARY} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>{tr('Staff Hours', 'Arbeitszeiten')}</Text>
                  <Text style={styles.modalSub}>{tr('Tap an employee card to clock in or out', 'Mitarbeiterkarte antippen zum Ein-/Ausstempeln')}</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={loadEmployees} activeOpacity={0.75} disabled={loading}>
                  {loading ? <ActivityIndicator color={PRIMARY} /> : <Ionicons name="refresh-outline" size={18} color={PRIMARY} />}
                </TouchableOpacity>

                <TouchableOpacity onPress={closeAll} style={styles.closeBtn} activeOpacity={0.75}>
                  <Ionicons name="close" size={18} color="#5B5F6B" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.staffSummaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{clockedInEmployees.length}</Text>
                <Text style={styles.summaryLabel}>{tr('Clocked in', 'Eingestempelt')}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{employees.length}</Text>
                <Text style={styles.summaryLabel}>{tr('Employees', 'Mitarbeiter')}</Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={tr('Search employee...', 'Mitarbeiter suchen...')}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.75}>
                  <Ionicons name="close-circle" size={18} color="#C0C4CE" />
                </TouchableOpacity>
              ) : null}
            </View>

            {loadError ? <Text style={styles.inlineError}>{loadError}</Text> : null}

            <ScrollView
              style={styles.staffScroll}
              contentContainerStyle={styles.staffGrid}
              showsVerticalScrollIndicator={false}
            >
              {loading && employees.length === 0 ? (
                <View style={styles.loadingArea}>
                  <ActivityIndicator color={PRIMARY} />
                  <Text style={styles.loadingText}>{tr('Loading employees...', 'Mitarbeiter werden geladen...')}</Text>
                </View>
              ) : employees.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="person-add-outline" size={34} color={PRIMARY} />
                  </View>
                  <Text style={styles.emptyTitle}>{tr('No employees yet', 'Noch keine Mitarbeiter')}</Text>
                  <Text style={styles.emptySub}>{tr('Add your first employee to start time tracking.', 'Füge den ersten Mitarbeiter hinzu, um Arbeitszeiten zu erfassen.')}</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setAddModal(true)} activeOpacity={0.78}>
                    <Text style={styles.emptyBtnText}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredEmployees.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconMuted}>
                    <Ionicons name="search-outline" size={32} color="#9CA3AF" />
                  </View>
                  <Text style={styles.emptyTitle}>{tr('No match found', 'Kein Treffer gefunden')}</Text>
                  <Text style={styles.emptySub}>{tr('Try another employee name.', 'Versuche einen anderen Namen.')}</Text>
                </View>
              ) : (
                filteredEmployees.map(renderEmployeeCard)
              )}
            </ScrollView>

            <View style={styles.staffFooter}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAddModal(true)} activeOpacity={0.78}>
                <Ionicons name="person-add-outline" size={16} color={PRIMARY} />
                <Text style={styles.secondaryBtnText}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openReport()} activeOpacity={0.78}>
                <Ionicons name="stats-chart-outline" size={16} color={PRIMARY} />
                <Text style={styles.secondaryBtnText}>{tr('Monthly Report', 'Monatsbericht')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!selectedEmployee} transparent animationType="fade" onRequestClose={() => setSelectedEmployeeId(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedEmployeeId(null)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            {selectedEmployee ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleWrap}>
                    <View style={[styles.modalAvatar, selectedEmployee.clocked_in && styles.modalAvatarActive]}>
                      <Text style={[styles.modalAvatarText, selectedEmployee.clocked_in && styles.modalAvatarTextActive]}>
                        {initials(selectedEmployee.name)}
                      </Text>
                    </View>
                    <View style={styles.modalHeaderText}>
                      <Text style={styles.modalTitle} numberOfLines={1}>{selectedEmployee.name}</Text>
                      <Text style={[styles.modalSub, { color: selectedEmployee.clocked_in ? GREEN : MUTED }]}>
                        {selectedEmployee.clocked_in ? tr('Currently clocked in', 'Aktuell eingestempelt') : tr('Currently clocked out', 'Aktuell ausgestempelt')}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity onPress={() => setSelectedEmployeeId(null)} style={styles.closeBtn} activeOpacity={0.75}>
                    <Ionicons name="close" size={18} color="#5B5F6B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.employeeDetailPanel}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{tr('Status', 'Status')}</Text>
                      <Text style={[styles.detailValue, { color: selectedEmployee.clocked_in ? GREEN : MUTED }]}>
                        {selectedEmployee.clocked_in ? tr('Clocked in', 'Eingestempelt') : tr('Clocked out', 'Ausgestempelt')}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{tr('Clock in time', 'Einstempelzeit')}</Text>
                      <Text style={styles.detailValue}>
                        {selectedEmployee.clocked_in ? formatTime(selectedEmployee.clock_in_time) : '—'}
                      </Text>
                    </View>

                    <View style={[styles.detailRow, styles.detailRowLast]}>
                      <Text style={styles.detailLabel}>{tr('Current shift', 'Aktuelle Schicht')}</Text>
                      <Text style={styles.detailValueStrong}>
                        {selectedEmployee.clocked_in
                          ? formatMinutes(minutesBetween(selectedEmployee.clock_in_time, null, now))
                          : '—'}
                      </Text>
                    </View>
                  </View>

                  {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

                  <TouchableOpacity
                    style={[
                      styles.bigClockBtn,
                      selectedEmployee.clocked_in ? styles.clockOutBtn : styles.clockInBtn,
                      clockingEmployeeId === selectedEmployee.id && styles.btnDisabled,
                    ]}
                    onPress={() => handleToggleClock(selectedEmployee)}
                    disabled={clockingEmployeeId === selectedEmployee.id}
                    activeOpacity={0.82}
                  >
                    {clockingEmployeeId === selectedEmployee.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name={selectedEmployee.clocked_in ? 'log-out-outline' : 'log-in-outline'}
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.bigClockBtnText}>
                          {selectedEmployee.clocked_in ? tr('Clock Out', 'Ausstempeln') : tr('Clock In', 'Einstempeln')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleDeactivate(selectedEmployee)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="trash-outline" size={17} color={RED} />
                    <Text style={styles.removeBtnText}>{tr('Remove employee', 'Mitarbeiter entfernen')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={addModal} transparent animationType="fade" onRequestClose={() => setAddModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAddModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="person-add-outline" size={20} color={PRIMARY} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
                  <Text style={styles.modalSub}>{tr('Create a new staff card', 'Neue Mitarbeiterkarte erstellen')}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setAddModal(false)} style={styles.closeBtn} activeOpacity={0.75}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>{tr('Employee name', 'Name des Mitarbeiters')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={tr('Example: Maria', 'Beispiel: Maria')}
                placeholderTextColor="#A8ACB7"
                value={newName}
                onChangeText={text => {
                  setNewName(text);
                  setAddError('');
                }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAddEmployee}
              />

              {addError ? <Text style={styles.errorText}>{addError}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, adding && styles.btnDisabled]}
                onPress={handleAddEmployee}
                disabled={adding}
                activeOpacity={0.8}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={reportModal} transparent animationType="fade" onRequestClose={() => setReportModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setReportModal(false)}>
          <TouchableOpacity style={[styles.modalBox, styles.reportModalBox]} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="stats-chart-outline" size={20} color={PRIMARY} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>{tr('Monthly Report', 'Monatsbericht')}</Text>
                  <Text style={styles.modalSub}>{tr('Hours and shifts per employee', 'Stunden und Schichten pro Mitarbeiter')}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setReportModal(false)} style={styles.closeBtn} activeOpacity={0.75}>
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

            <View style={styles.reportSummaryRow}>
              <View style={styles.reportSummaryCard}>
                <Text style={styles.reportSummaryNumber}>{formatHours(reportTotalHours)}</Text>
                <Text style={styles.reportSummaryLabel}>{tr('Total hours', 'Gesamtstunden')}</Text>
              </View>

              <View style={styles.reportSummaryCard}>
                <Text style={styles.reportSummaryNumber}>{reportShiftCount}</Text>
                <Text style={styles.reportSummaryLabel}>{tr('Shifts', 'Schichten')}</Text>
              </View>
            </View>

            {reportError ? <Text style={styles.inlineError}>{reportError}</Text> : null}

            <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportList} showsVerticalScrollIndicator={false}>
              {reportLoading ? (
                <View style={styles.loadingArea}>
                  <ActivityIndicator color={PRIMARY} />
                  <Text style={styles.loadingText}>{tr('Loading report...', 'Bericht wird geladen...')}</Text>
                </View>
              ) : reportData.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconMuted}>
                    <Ionicons name="calendar-outline" size={32} color="#9CA3AF" />
                  </View>
                  <Text style={styles.emptyTitle}>{tr('No data for this month', 'Keine Daten für diesen Monat')}</Text>
                  <Text style={styles.emptySub}>{tr('Clocked shifts will appear here.', 'Gestempelte Schichten erscheinen hier.')}</Text>
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
                            {(row.shifts?.length || 0)} {tr('shifts', 'Schichten')}
                          </Text>
                        </View>

                        <Text style={styles.reportHours}>{formatHours(row.total_hours)}</Text>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
                      </TouchableOpacity>

                      {isExpanded ? (
                        <View style={styles.shiftList}>
                          {row.shifts?.length ? row.shifts.map((shift, i) => (
                            <View key={`${shift.clock_in}-${i}`} style={styles.shiftRow}>
                              <View style={styles.shiftIconBox}>
                                <Ionicons name={shift.clock_out ? 'checkmark-outline' : 'time-outline'} size={15} color={shift.clock_out ? GREEN : ORANGE} />
                              </View>

                              <View style={styles.shiftTextWrap}>
                                <Text style={styles.shiftDate}>{formatDate(shift.clock_in, isGerman)}</Text>
                                <Text style={styles.shiftTime}>
                                  {formatTime(shift.clock_in)} → {shift.clock_out ? formatTime(shift.clock_out) : tr('now', 'jetzt')}
                                </Text>
                              </View>

                              <Text style={styles.shiftDuration}>{formatShiftDuration(shift, now)}</Text>
                            </View>
                          )) : (
                            <Text style={styles.noShiftText}>{tr('No shifts saved', 'Keine Schichten gespeichert')}</Text>
                          )}
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
    </View>
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
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#555B66',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  entryCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  entryIconBox: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  entryText: {
    flex: 1,
    minWidth: 0,
  },

  entryTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  entrySub: {
    fontSize: fontSizes.smd,
    color: MUTED,
    marginTop: 3,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  lockPillText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.extrabold,
    color: PRIMARY,
    fontFamily: appFont,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },

  modalBox: {
    width: '92%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: radii.massive,
    overflow: 'hidden',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  staffModalBox: {
    width: '95%',
    maxWidth: 660,
    maxHeight: '88%',
  },

  reportModalBox: {
    width: '95%',
    maxWidth: 620,
    maxHeight: '88%',
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

  modalTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  modalTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  modalSub: {
    marginTop: 3,
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  closeBtn: {
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

  errorText: {
    color: RED,
    fontSize: fontSizes.smd,
    marginBottom: 12,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
    textAlign: 'center',
  },

  inlineError: {
    marginHorizontal: 18,
    marginTop: 10,
    color: RED,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
    textAlign: 'center',
  },

  primaryBtn: {
    minHeight: 48,
    backgroundColor: PRIMARY,
    borderRadius: radii.lgl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnDisabled: {
    backgroundColor: '#C7CBD4',
  },

  primaryBtnText: {
    color: '#fff',
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  staffSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  summaryNumber: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  summaryLabel: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
  },

  searchWrap: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 18,
    marginTop: 12,
    paddingHorizontal: 13,
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: fontSizes.mdl,
    color: TEXT,
    fontWeight: fontWeights.medium,
    fontFamily: appFont,
  },

  staffScroll: {
    maxHeight: 430,
  },

  staffGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 18,
    paddingBottom: 16,
  },

  employeeCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 185,
    backgroundColor: '#FAFAFB',
    borderRadius: radii.xxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 14,
  },

  employeeCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  employeeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarActive: {
    backgroundColor: GREEN,
  },

  avatarText: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  avatarTextActive: {
    color: '#fff',
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusPillIn: {
    backgroundColor: '#DCFCE7',
  },

  statusPillOut: {
    backgroundColor: '#F2F3F7',
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
  },

  statusPillText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  employeeName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  employeeMeta: {
    marginTop: 4,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    fontFamily: appFont,
  },

  employeeDuration: {
    marginTop: 8,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: GREEN,
    fontFamily: appFont,
  },

  employeeDurationMuted: {
    marginTop: 8,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: '#C0C4CE',
    fontFamily: appFont,
  },

  employeeCardFooter: {
    minHeight: 34,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  employeeActionHint: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  loadingArea: {
    width: '100%',
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  loadingText: {
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  emptyState: {
    width: '100%',
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.xxl,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyIconMuted: {
    width: 72,
    height: 72,
    borderRadius: radii.xxl,
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
    marginTop: 5,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    fontFamily: appFont,
    textAlign: 'center',
    lineHeight: 18,
  },

  emptyBtn: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: radii.lgl,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },

  emptyBtnText: {
    color: '#fff',
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  staffFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },

  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lgl,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },

  secondaryBtnText: {
    color: PRIMARY,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
    fontSize: fontSizes.smd,
    textAlign: 'center',
  },

  modalAvatar: {
    width: 46,
    height: 46,
    borderRadius: radii.full,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalAvatarActive: {
    backgroundColor: GREEN,
  },

  modalAvatarText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  modalAvatarTextActive: {
    color: '#fff',
  },

  employeeDetailPanel: {
    backgroundColor: '#FAFAFB',
    borderRadius: radii.xl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    marginBottom: 14,
    overflow: 'hidden',
  },

  detailRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },

  detailRowLast: {
    borderBottomWidth: 0,
  },

  detailLabel: {
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  detailValue: {
    fontSize: fontSizes.mdl,
    color: TEXT,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  detailValueStrong: {
    fontSize: fontSizes.lg,
    color: TEXT,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  bigClockBtn: {
    minHeight: 54,
    borderRadius: radii.lgl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  clockInBtn: {
    backgroundColor: GREEN,
  },

  clockOutBtn: {
    backgroundColor: RED,
  },

  bigClockBtnText: {
    color: '#fff',
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  removeBtn: {
    minHeight: 44,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.lgl,
    backgroundColor: '#FEF2F2',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
  },

  removeBtnText: {
    color: RED,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
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
    textTransform: 'capitalize',
  },

  reportSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
  },

  reportSummaryCard: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  reportSummaryNumber: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  reportSummaryLabel: {
    marginTop: 3,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: MUTED,
    fontFamily: appFont,
  },

  reportScroll: {
    maxHeight: 430,
  },

  reportList: {
    padding: 18,
    gap: 10,
  },

  reportEmployeeCard: {
    backgroundColor: '#FAFAFB',
    borderRadius: radii.xl,
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
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reportAvatarText: {
    color: PRIMARY,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
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
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },

  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEF0F5',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  shiftIconBox: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: '#F2F3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shiftTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  shiftDate: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  shiftTime: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    fontFamily: appFont,
  },

  shiftDuration: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  noShiftText: {
    paddingVertical: 12,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    textAlign: 'center',
    fontFamily: appFont,
  },
});
