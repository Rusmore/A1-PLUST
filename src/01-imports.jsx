import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard, FileText, Wallet, Receipt, Database, Plus, Download,
  Check, X, Search, AlertTriangle, TrendingUp, Users, Building2, Trash2,
  Edit3, ChevronRight, Banknote, ClipboardList, PiggyBank, CircleDollarSign,
  ArrowUpRight, ArrowDownRight, FileSpreadsheet, RefreshCw, Filter as FilterIcon,
  Printer, Bell, History, ShieldCheck, ArrowLeftRight, Clock, UserCog, Landmark, LogOut,
  Settings, KeyRound
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import * as XLSX from "xlsx";

