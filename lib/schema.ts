import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  bigint,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Network policy objects
// ---------------------------------------------------------------------------

export const bandwidthProfiles = pgTable("bandwidth_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  downKbps: integer("down_kbps").notNull(),
  upKbps: integer("up_kbps").notNull(),
  burstKbps: integer("burst_kbps"),
  priority: integer("priority").notNull().default(8),
  fupThresholdGb: integer("fup_threshold_gb"),
});

export const ipPools = pgTable("ip_pools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rangeCidr: text("range_cidr").notNull(),
  routerId: text("router_id").notNull(),
});

export const nasDevices = pgTable("nas_devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ip: text("ip").notNull(),
  type: text("type").notNull(),
  sharedSecretMasked: text("shared_secret_masked").notNull().default("••••••••"),
  linkedOltId: text("linked_olt_id"),
  coaSupport: boolean("coa_support").notNull().default(true),
});

// ---------------------------------------------------------------------------
// ODN fibre plant (OLT -> PON port -> Fiber -> DN -> Fiber -> SN -> ONU)
// ---------------------------------------------------------------------------

export const olts = pgTable("olts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  vendor: text("vendor").notNull(),
  model: text("model").notNull(),
  serial: text("serial").notNull(),
  site: text("site").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  mgmtIp: text("mgmt_ip").notNull(),
  installDate: timestamp("install_date").notNull(),
  adminStatus: text("admin_status").notNull().default("up"),
  operStatus: text("oper_status").notNull().default("up"),
  firmware: text("firmware"),
  temperatureC: doublePrecision("temperature_c").notNull().default(42),
});

export const ponPorts = pgTable("pon_ports", {
  id: text("id").primaryKey(),
  oltId: text("olt_id").notNull(),
  slot: integer("slot").notNull(),
  port: integer("port").notNull(),
  adminStatus: text("admin_status").notNull().default("up"),
  operStatus: text("oper_status").notNull().default("up"),
  txDbm: doublePrecision("tx_dbm").notNull().default(4.5),
});

export const fibers = pgTable("fibers", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // feeder | distribution | drop
  fromType: text("from_type").notNull(),
  fromId: text("from_id").notNull(),
  toType: text("to_type").notNull(),
  toId: text("to_id").notNull(),
  lengthM: integer("length_m").notNull(),
  coreCount: integer("core_count").notNull().default(12),
  lossBudgetDb: doublePrecision("loss_budget_db").notNull().default(21),
  route: jsonb("route").$type<[number, number][]>().notNull(),
});

export const distributionNodes = pgTable("distribution_nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  zone: text("zone").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  splitRatio: integer("split_ratio").notNull().default(4),
  ponPortId: text("pon_port_id").notNull(),
  feederFiberId: text("feeder_fiber_id").notNull(),
  installDate: timestamp("install_date").notNull(),
  condition: text("condition").notNull().default("good"),
});

export const splitterNodes = pgTable("splitter_nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  zone: text("zone").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  splitRatio: integer("split_ratio").notNull().default(16),
  dnId: text("dn_id").notNull(),
  distributionFiberId: text("distribution_fiber_id").notNull(),
  installDate: timestamp("install_date").notNull(),
  condition: text("condition").notNull().default("good"),
});

export const onus = pgTable("onus", {
  id: text("id").primaryKey(),
  serial: text("serial").notNull(),
  mac: text("mac").notNull(),
  vendor: text("vendor").notNull(),
  model: text("model").notNull(),
  snId: text("sn_id").notNull(),
  snPort: integer("sn_port").notNull(),
  customerId: text("customer_id"),
  installDate: timestamp("install_date").notNull(),
  lastReboot: timestamp("last_reboot"),
  status: text("status").notNull().default("online"), // online | offline
  rxDbmBase: doublePrecision("rx_dbm_base").notNull(),
  txDbmBase: doublePrecision("tx_dbm_base").notNull(),
});

// ---------------------------------------------------------------------------
// Business / BSS objects
// ---------------------------------------------------------------------------

export const tariffs = pgTable("tariffs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"), // active | draft | retired
  billingType: text("billing_type").notNull(), // prepaid | postpaid
  accountType: text("account_type").notNull(), // personal | business
  priceMmk: integer("price_mmk").notNull(),
  validityDays: integer("validity_days").notNull(),
  bandwidthProfileId: text("bandwidth_profile_id").notNull(),
  ipPoolId: text("ip_pool_id").notNull(),
  nasId: text("nas_id").notNull(),
  expiredBehavior: text("expired_behavior").notNull().default("suspend"), // suspend | disable | grace
});

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  accountType: text("account_type").notNull().default("personal"), // personal | business
  zone: text("zone").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  status: text("status").notNull().default("active"), // active | grace | suspended | expired | banned | disabled
  installedDate: timestamp("installed_date").notNull(),
  tariffId: text("tariff_id"),
  expiryDate: timestamp("expiry_date"),
  balanceMmk: integer("balance_mmk").notNull().default(0),
  snId: text("sn_id"),
  snPort: integer("sn_port"),
  pppoeUsername: text("pppoe_username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  tariffId: text("tariff_id"),
  amountMmk: integer("amount_mmk").notNull(),
  taxMmk: integer("tax_mmk").notNull().default(0),
  issuedDate: timestamp("issued_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  status: text("status").notNull().default("pending"), // paid | pending | overdue
  method: text("method"),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id"),
  customerId: text("customer_id").notNull(),
  amountMmk: integer("amount_mmk").notNull(),
  method: text("method").notNull(), // kbzpay | wavepay | cash | bank | wallet
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  reconciled: boolean("reconciled").notNull().default(true),
});

export const vouchers = pgTable("vouchers", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  tariffId: text("tariff_id").notNull(),
  status: text("status").notNull().default("unused"), // unused | used
  generatedBy: text("generated_by"),
  redeemedByCustomerId: text("redeemed_by_customer_id"),
  redeemedAt: timestamp("redeemed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("normal"), // low | normal | high | critical
  status: text("status").notNull().default("open"), // open | assigned | in-progress | resolved
  technician: text("technician"),
  notes: text("notes"),
  slaDueAt: timestamp("sla_due_at"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const inventoryItems = pgTable("inventory_items", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(10),
  unitCostMmk: integer("unit_cost_mmk").notNull().default(0),
  bin: text("bin"),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  serial: text("serial").notNull(),
  mac: text("mac"),
  model: text("model").notNull(),
  boundCustomerId: text("bound_customer_id"),
  issuedBy: text("issued_by"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});

export const alarms = pgTable("alarms", {
  id: text("id").primaryKey(),
  code: text("code").notNull(), // LOS | DYING-GASP | OPTICAL-LOW | OPTICAL-HIGH | TEMP-HIGH | LINK-DOWN | REBOOT | REG-FAIL
  severity: text("severity").notNull(), // critical | major | minor | warning
  objectType: text("object_type").notNull(), // olt | pon_port | dn | sn | onu | customer
  objectId: text("object_id").notNull(),
  path: text("path"),
  raisedAt: timestamp("raised_at").notNull().defaultNow(),
  clearedAt: timestamp("cleared_at"),
  state: text("state").notNull().default("current"), // current | acknowledged | cleared
  note: text("note"),
});

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // sales | cashier | network_ops | sysadmin | management
  active: boolean("active").notNull().default(true),
  passwordHash: text("password_hash"), // scrypt:<saltHex>:<hashHex> — null until a password is set
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // opaque random token, also the value stored in the session cookie
  staffId: text("staff_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  userAgent: text("user_agent"),
});

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  objectType: text("object_type"),
  objectId: text("object_id"),
  detail: text("detail"),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  audience: text("audience").notNull(), // all | new | expired | active | business
  channel: text("channel").notNull(), // sms | whatsapp | email
  template: text("template").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | test_passed | sent
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// CRM: leads (pre-sale inquiries, distinct from provisioned customers)
// ---------------------------------------------------------------------------

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  source: text("source").notNull().default("website"), // website | referral | walk-in | facebook | call | field-survey
  zone: text("zone"),
  address: text("address"),
  interestedTariffId: text("interested_tariff_id"),
  status: text("status").notNull().default("new"), // new | contacted | qualified | quoted | won | lost
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  lostReason: text("lost_reason"),
  convertedCustomerId: text("converted_customer_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Scheduling: field visits (installation, repair, maintenance, survey)
// ---------------------------------------------------------------------------

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // installation | repair | maintenance | survey
  customerId: text("customer_id"),
  leadId: text("lead_id"),
  ticketId: text("ticket_id"),
  technician: text("technician").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  status: text("status").notNull().default("pending"), // pending | in-progress | completed | cancelled
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
