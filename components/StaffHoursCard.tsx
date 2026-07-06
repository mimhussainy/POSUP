import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
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
const CARD_BG = colors.cardBg;
const BORDER = colors.borderStrong;
const TEXT = colors.text;
const MUTED = colors.muted;
const GREEN = colors.success;
const RED = colors.danger;
const thinBorder = borders.thin;

type Employee = {
  id: string;
  name: string;
  clocked_in: boolean;
  clock_in_time: string | null;
};

type ReportRow = {
  employee_id: string;
  name: string;
  total_hours: number;
  shifts: { clock_in: string; clock_out: string | null }[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
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

  const [mainModal, setMainModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [reportModal, setReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(currentMonthString());
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStaffEmployees(restaurantCode);
      if (res.success) setEmployees(res.employees);
    } catch (e) {
      console.log('Failed to load employees', e);
    } finally {
      setLoading(false);
    }
  }, [restaurantCode]);

  const openPinModal = () => {
    setPinInput('');
    setPinError('');
    setPinModal(true);
  };

  const handleVerifyPin = async () => {
    if (!pinInput) return;
    setVerifying(true);
    setPinError('');
    try {
      const res = await verifyAdminPin(restaurantCode, pinInput);
      if (res.success) {
        setPinModal(false);
        setMainModal(true);
        loadEmployees();
      } else {
        setPinError(res.error || tr('Incorrect PIN', 'Falsche PIN'));
      }
    } catch (e) {
      setPinError(tr('Could not verify PIN', 'PIN konnte nicht überprüft werden'));
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleClock = async (employeeId: string) => {
    try {
      await toggleStaffClock(employeeId, restaurantCode);
      loadEmployees();
    } catch (e) {
      console.log('Clock toggle failed', e);
    }
  };

  const handleAddEmployee = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await addStaffEmployee(restaurantCode, newName.trim());
      if (res.success) {
        setNewName('');
        setAddModal(false);
        loadEmployees();
      }
    } catch (e) {
      console.log('Add employee failed', e);
    } finally {
      setAdding(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateStaffEmployee(id);
      loadEmployees();
    } catch (e) {
      console.log('Deactivate failed', e);
    }
  };

  const openReport = async (month: string = reportMonth) => {
    setReportMonth(month);
    setReportLoading(true);
    setReportModal(true);
    try {
      const res = await fetchStaffReport(restaurantCode, month);
      if (res.success) setReportData(res.report);
    } catch (e) {
      console.log('Report load failed', e);
    } finally {
      setReportLoading(false);
    }
  };

  const closeAll = () => {
    setMainModal(false);
    setReportModal(false);
    setAddModal(false);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr('STAFF', 'PERSONAL')}</Text>
      </View>

      <TouchableOpacity style={styles.card} activeOpacity={0.78} onPress={openPinModal}>
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <Ionicons name="people-outline" size={19} color={PRIMARY} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{tr('Staff Hours', 'Arbeitszeiten')}</Text>
            <Text style={styles.rowSub}>{tr('Clock employees in and out', 'Mitarbeiter ein-/ausstempeln')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color="#C0C4CE" />
        </View>
      </TouchableOpacity>

      {/* PIN unlock */}
      <Modal visible={pinModal} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPinModal(false)}>
          <TouchableOpacity style={styles.box} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{tr('Admin PIN', 'Admin-PIN')}</Text>
              <TouchableOpacity onPress={() => setPinModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.pinInput}
                placeholder={tr('Enter admin PIN', 'Admin-PIN eingeben')}
                placeholderTextColor="#A8ACB7"
                value={pinInput}
                onChangeText={setPinInput}
                secureTextEntry
                keyboardType="number-pad"
                autoFocus
              />
              {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
              <TouchableOpacity
                style={[styles.primaryBtn, verifying && styles.btnDisabled]}
                onPress={handleVerifyPin}
                disabled={verifying}
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

      {/* Employee list */}
      <Modal visible={mainModal} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeAll}>
          <TouchableOpacity style={[styles.box, styles.bigBox]} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{tr('Staff Hours', 'Arbeitszeiten')}</Text>
              <TouchableOpacity onPress={closeAll} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.bigBoxScroll}>
              {loading ? (
                <ActivityIndicator color={PRIMARY} style={{ marginVertical: 20 }} />
              ) : employees.length === 0 ? (
                <Text style={styles.emptyText}>{tr('No employees yet', 'Noch keine Mitarbeiter')}</Text>
              ) : (
                employees.map(emp => (
                  <View key={emp.id} style={styles.empRow}>
                    <View style={styles.empInfo}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      <Text style={[styles.empStatus, { color: emp.clocked_in ? GREEN : MUTED }]}>
                        {emp.clocked_in
                          ? tr(
                              `Clocked in since ${formatTime(emp.clock_in_time!)}`,
                              `Eingestempelt seit ${formatTime(emp.clock_in_time!)}`
                            )
                          : tr('Clocked out', 'Ausgestempelt')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.clockBtn, { backgroundColor: emp.clocked_in ? '#FEF2F2' : '#EAFBF1' }]}
                      onPress={() => handleToggleClock(emp.id)}
                    >
                      <Text style={{ color: emp.clocked_in ? RED : GREEN, fontWeight: fontWeights.extrabold, fontFamily: appFont }}>
                        {emp.clocked_in ? tr('Clock Out', 'Ausstempeln') : tr('Clock In', 'Einstempeln')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeactivate(emp.id)} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={18} color="#C0C4CE" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.bigBoxFooter}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAddModal(true)}>
                <Ionicons name="person-add-outline" size={16} color={PRIMARY} />
                <Text style={styles.secondaryBtnText}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openReport()}>
                <Ionicons name="stats-chart-outline" size={16} color={PRIMARY} />
                <Text style={styles.secondaryBtnText}>{tr('Monthly Report', 'Monatsbericht')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add employee */}
      <Modal visible={addModal} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAddModal(false)}>
          <TouchableOpacity style={styles.box} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{tr('Add Employee', 'Mitarbeiter hinzufügen')}</Text>
              <TouchableOpacity onPress={() => setAddModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.textInput}
                placeholder={tr('Employee name', 'Name des Mitarbeiters')}
                placeholderTextColor="#A8ACB7"
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.primaryBtn, adding && styles.btnDisabled]}
                onPress={handleAddEmployee}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{tr('Add', 'Hinzufügen')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Monthly report */}
      <Modal visible={reportModal} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setReportModal(false)}>
          <TouchableOpacity style={[styles.box, styles.bigBox]} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{tr('Monthly Report', 'Monatsbericht')}</Text>
              <TouchableOpacity onPress={() => setReportModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => openReport(currentMonthString(monthOffset(reportMonth) - 1))}>
                <Ionicons name="chevron-back" size={20} color={PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthLabel(reportMonth, isGerman)}</Text>
              <TouchableOpacity onPress={() => openReport(currentMonthString(monthOffset(reportMonth) + 1))}>
                <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.bigBoxScroll}>
              {reportLoading ? (
                <ActivityIndicator color={PRIMARY} style={{ marginVertical: 20 }} />
              ) : reportData.length === 0 ? (
                <Text style={styles.emptyText}>{tr('No data for this month', 'Keine Daten für diesen Monat')}</Text>
              ) : (
                reportData.map(row => (
                  <View key={row.employee_id}>
                    <TouchableOpacity
                      style={styles.reportRow}
                      onPress={() => setExpandedRow(expandedRow === row.employee_id ? null : row.employee_id)}
                    >
                      <Text style={styles.empName}>{row.name}</Text>
                      <Text style={styles.reportHours}>{formatHours(row.total_hours)}</Text>
                    </TouchableOpacity>
                    {expandedRow === row.employee_id &&
                      row.shifts.map((shift, i) => (
                        <View key={i} style={styles.shiftRow}>
                          <Text style={styles.shiftText}>
                            {new Date(shift.clock_in).toLocaleDateString(isGerman ? 'de-CH' : 'en-US')}
                            {'  '}
                            {formatTime(shift.clock_in)} → {shift.clock_out ? formatTime(shift.clock_out) : tr('now', 'jetzt')}
                          </Text>
                        </View>
                      ))}
                  </View>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%' },
  sectionHeader: { marginBottom: 8, paddingHorizontal: 3 },
  sectionTitle: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#555B66',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: TEXT, fontFamily: appFont },
  rowSub: { fontSize: fontSizes.smd, color: MUTED, marginTop: 3, fontWeight: fontWeights.semibold, fontFamily: appFont },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: radii.massive,
    width: '92%',
    maxWidth: 430,
    overflow: 'hidden',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },
  bigBox: { maxWidth: 520, maxHeight: '80%' },
  bigBoxScroll: { paddingHorizontal: 18, maxHeight: 380 },
  bigBoxFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
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
  modalTitle: { fontSize: fontSizes.xxl, fontWeight: fontWeights.extrabold, color: TEXT, fontFamily: appFont },
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
  modalBody: { padding: 18 },
  pinInput: {
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
    textAlign: 'center',
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
  errorText: { color: RED, fontSize: fontSizes.smd, marginBottom: 10, fontFamily: appFont, textAlign: 'center' },
  primaryBtn: { backgroundColor: PRIMARY, borderRadius: radii.lgl, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#C7CBD4' },
  primaryBtnText: { color: '#fff', fontSize: fontSizes.mdl, fontWeight: fontWeights.extrabold, fontFamily: appFont },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lgl,
    paddingVertical: 12,
  },
  secondaryBtnText: { color: PRIMARY, fontWeight: fontWeights.extrabold, fontFamily: appFont, fontSize: fontSizes.smd },
  emptyText: { textAlign: 'center', color: MUTED, fontFamily: appFont, marginVertical: 24 },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F1F5',
  },
  empInfo: { flex: 1, minWidth: 0 },
  empName: { fontSize: fontSizes.mdl, fontWeight: fontWeights.extrabold, color: TEXT, fontFamily: appFont },
  empStatus: { fontSize: fontSizes.smd, marginTop: 2, fontWeight: fontWeights.semibold, fontFamily: appFont },
  clockBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  monthLabel: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
    minWidth: 160,
    textAlign: 'center',
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F1F5',
  },
  reportHours: { fontSize: fontSizes.mdl, fontWeight: fontWeights.extrabold, color: PRIMARY, fontFamily: appFont },
  shiftRow: { paddingVertical: 6, paddingLeft: 12 },
  shiftText: { fontSize: fontSizes.smd, color: MUTED, fontFamily: appFont },
});