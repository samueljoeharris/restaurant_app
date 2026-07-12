/* @ds-bundle: {"format":3,"namespace":"LittleScoutDesignSystem_caae7d","components":[{"name":"AttributeChip","sourcePath":"components/core/AttributeChip.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"BottomNav","sourcePath":"components/core/BottomNav.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"RestaurantListCard","sourcePath":"components/core/RestaurantListCard.jsx"},{"name":"SpeedBadge","sourcePath":"components/core/SpeedBadge.jsx"},{"name":"Toggle","sourcePath":"components/core/Toggle.jsx"},{"name":"UpdateCard","sourcePath":"components/core/UpdateCard.jsx"}],"sourceHashes":{"components/core/AttributeChip.jsx":"60d0fce8a2a1","components/core/Badge.jsx":"c11da59bb70c","components/core/BottomNav.jsx":"321e5bdeb4a9","components/core/Button.jsx":"1bc83c08b00c","components/core/Input.jsx":"924450ab4632","components/core/RestaurantListCard.jsx":"ddbede2b9535","components/core/SpeedBadge.jsx":"243fd1aabfb1","components/core/Toggle.jsx":"780cf7402111","components/core/UpdateCard.jsx":"a4c3042d6df0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LittleScoutDesignSystem_caae7d = window.LittleScoutDesignSystem_caae7d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/AttributeChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Parent-attribute pill (high chairs, changing table, filters…).
 */
function AttributeChip({
  label,
  icon,
  active = false,
  dashed = false,
  style,
  ...rest
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "var(--ls-font-body)",
    fontWeight: 700,
    fontSize: 12,
    padding: "8px 13px",
    borderRadius: "var(--ls-radius-full)",
    cursor: rest.onClick ? "pointer" : "default",
    whiteSpace: "nowrap"
  };
  const skin = active ? {
    background: "var(--ls-sky)",
    color: "#fff",
    border: "1.5px solid var(--ls-sky)"
  } : dashed ? {
    background: "var(--ls-surface)",
    color: "var(--ls-ink-muted)",
    border: "1.5px dashed var(--ls-border-strong)"
  } : {
    background: "var(--ls-surface)",
    color: "#5E5446",
    border: "1.5px solid var(--ls-border)"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      ...base,
      ...skin,
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, icon) : null, label);
}
Object.assign(__ds_scope, { AttributeChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/AttributeChip.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Little Scout inline label pill. Matches the web app's Badge variants.
 */
function Badge({
  variant = "neutral",
  children,
  style,
  ...rest
}) {
  const variants = {
    neutral: {
      background: "var(--ls-surface-muted)",
      color: "var(--ls-ink-muted)"
    },
    brand: {
      background: "var(--ls-sky-soft)",
      color: "var(--ls-sky-deep)"
    },
    success: {
      background: "var(--ls-ttf-fast-soft)",
      color: "var(--ls-ttf-fast)"
    },
    warning: {
      background: "var(--ls-ttf-ok-soft)",
      color: "var(--ls-ttf-ok)"
    },
    error: {
      background: "var(--ls-ttf-slow-soft)",
      color: "var(--ls-ttf-slow)"
    },
    accent: {
      background: "var(--ls-mango-soft)",
      color: "var(--ls-mango-deep)"
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "var(--ls-radius-full)",
      padding: "3px 9px",
      fontSize: 11.5,
      fontFamily: "var(--ls-font-body)",
      fontWeight: 700,
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/BottomNav.jsx
try { (() => {
/**
 * Mobile bottom tab bar. Active tab in sky blue.
 */
function BottomNav({
  items = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      borderTop: "1px solid #EFE6D3",
      padding: "9px 6px 13px",
      background: "var(--ls-surface)",
      ...style
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: it.onClick,
    style: {
      flex: 1,
      textAlign: "center",
      fontFamily: "var(--ls-font-display)",
      fontWeight: 700,
      fontSize: 10,
      color: it.active ? "var(--ls-sky)" : "#B8AB97",
      cursor: it.onClick ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      lineHeight: 1.1
    },
    "aria-hidden": "true"
  }, it.icon), it.label)));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/BottomNav.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Little Scout primary action button. Sky-blue brand fill by default.
 */
function Button({
  variant = "primary",
  size = "md",
  children,
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      padding: "9px 16px",
      fontSize: 13
    },
    md: {
      padding: "12px 22px",
      fontSize: 14
    },
    lg: {
      padding: "14px 26px",
      fontSize: 15
    }
  };
  const variants = {
    primary: {
      background: "var(--ls-sky)",
      color: "#fff",
      border: "none",
      boxShadow: "var(--ls-shadow-brand)"
    },
    secondary: {
      background: "var(--ls-surface)",
      color: "var(--ls-sky-deep)",
      border: "1.5px solid var(--ls-sky-soft)"
    },
    soft: {
      background: "var(--ls-mango-soft)",
      color: "var(--ls-mango-deep)",
      border: "none"
    },
    ghost: {
      background: "transparent",
      color: "var(--ls-ink-muted)",
      border: "none",
      boxShadow: "none"
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    style: {
      fontFamily: "var(--ls-font-display)",
      fontWeight: 700,
      borderRadius: "var(--ls-radius-button)",
      cursor: "pointer",
      transition: "transform var(--ls-dur-fast) var(--ls-ease-out), filter var(--ls-dur-fast)",
      ...sizes[size],
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Little Scout branded text input with optional label, helper, and error state.
 */
function Input({
  label,
  helper,
  error,
  id,
  style,
  inputStyle,
  ...rest
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 5,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 700,
      fontSize: 12.5,
      color: error ? "var(--ls-ttf-slow)" : "var(--ls-ink)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 600,
      fontSize: 14,
      color: "var(--ls-ink)",
      background: "var(--ls-surface)",
      border: error ? "1.5px solid var(--ls-ttf-slow)" : "1.5px solid var(--ls-border-strong)",
      borderRadius: "var(--ls-radius-md)",
      padding: "11px 14px",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
      transition: "border-color var(--ls-dur-fast) var(--ls-ease-out), box-shadow var(--ls-dur-fast)",
      ...inputStyle
    }
  }, rest)), helper || error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 600,
      fontSize: 11.5,
      color: error ? "var(--ls-ttf-slow)" : "var(--ls-ink-muted)"
    }
  }, error || helper) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/RestaurantListCard.jsx
try { (() => {
const TTF_COLORS = {
  fast: "var(--ls-ttf-fast)",
  ok: "var(--ls-ttf-ok)",
  slow: "var(--ls-ttf-slow)",
  none: "var(--ls-ttf-none)"
};
const TTF_SOFT = {
  fast: "var(--ls-ttf-fast-soft)",
  ok: "var(--ls-ttf-ok-soft)",
  slow: "var(--ls-ttf-slow-soft)",
  none: "var(--ls-ttf-none-soft)"
};

/**
 * Restaurant list item — default card or compact row density.
 * Matches the production RestaurantListCard visual design.
 */
function RestaurantListCard({
  name,
  address,
  ttfMinutes,
  ttfTier = "none",
  ttfLabel,
  badges = [],
  watched = false,
  active = false,
  density = "default",
  onSelect,
  onWatch,
  style
}) {
  const tierColor = TTF_COLORS[ttfTier] || TTF_COLORS.none;
  const tierSoft = TTF_SOFT[ttfTier] || TTF_SOFT.none;
  const hasTtf = ttfMinutes != null;
  if (density === "compact") {
    return /*#__PURE__*/React.createElement("div", {
      onClick: onSelect,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "11px 16px",
        borderBottom: "1px solid var(--ls-border)",
        background: active ? "var(--ls-sky-soft)" : "transparent",
        cursor: onSelect ? "pointer" : "default",
        ...style
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--ls-font-display)",
        fontWeight: 700,
        fontSize: 13,
        color: "var(--ls-ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, name), hasTtf && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: tierColor,
        flexShrink: 0
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontFamily: "var(--ls-font-body)",
        fontWeight: 600,
        fontSize: 11.5,
        color: "var(--ls-ink-muted)",
        marginTop: 2,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, hasTtf ? `Speed ${ttfMinutes} min${ttfTier === "none" ? " · early" : ""}` : "No speed yet", watched ? " · saved" : "")));
  }
  return /*#__PURE__*/React.createElement("div", {
    onClick: onSelect,
    style: {
      background: "var(--ls-surface)",
      border: active ? "1.5px solid var(--ls-sky)" : "1px solid var(--ls-border)",
      borderRadius: "var(--ls-radius-md)",
      padding: "14px 16px",
      boxShadow: active ? "0 0 0 3px var(--ls-sky-soft)" : "var(--ls-shadow-sm)",
      cursor: onSelect ? "pointer" : "default",
      display: "grid",
      gap: 4,
      transition: "transform var(--ls-dur-fast) var(--ls-ease-out), box-shadow var(--ls-dur-fast)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-display)",
      fontWeight: 700,
      fontSize: 15,
      color: "var(--ls-ink)"
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, hasTtf && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: tierColor,
      flexShrink: 0
    }
  }), onWatch && /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onWatch(!watched);
    },
    style: {
      fontSize: 16,
      cursor: "pointer",
      opacity: watched ? 1 : 0.4,
      transition: "opacity var(--ls-dur-fast)"
    }
  }, "\uD83D\uDC9B"))), address && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 600,
      fontSize: 12.5,
      color: "var(--ls-ink-muted)"
    }
  }, address), (hasTtf || badges.length > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6
    }
  }, hasTtf && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "var(--ls-font-body)",
      fontWeight: 700,
      fontSize: 11.5,
      background: tierSoft,
      color: tierColor,
      borderRadius: "var(--ls-radius-full)",
      padding: "3px 10px"
    }
  }, "Speed ", ttfMinutes, " min", ttfTier === "none" ? " · early" : ""), badges.map((b, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "var(--ls-font-body)",
      fontWeight: 700,
      fontSize: 11.5,
      background: "var(--ls-surface-muted)",
      color: "var(--ls-ink-muted)",
      borderRadius: "var(--ls-radius-full)",
      padding: "3px 10px"
    }
  }, b)), !hasTtf && badges.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 600,
      fontSize: 12.5,
      color: "var(--ls-ink-muted)"
    }
  }, "Be the first to contribute")));
}
Object.assign(__ds_scope, { RestaurantListCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/RestaurantListCard.jsx", error: String((e && e.message) || e) }); }

// components/core/SpeedBadge.jsx
try { (() => {
const TIERS = {
  fast: {
    color: "var(--ls-ttf-fast)",
    soft: "var(--ls-ttf-fast-soft)",
    label: "Fast"
  },
  ok: {
    color: "var(--ls-ttf-ok)",
    soft: "var(--ls-ttf-ok-soft)",
    label: "OK"
  },
  slow: {
    color: "var(--ls-ttf-slow)",
    soft: "var(--ls-ttf-slow-soft)",
    label: "Slow"
  },
  none: {
    color: "var(--ls-ttf-none)",
    soft: "var(--ls-ttf-none-soft)",
    label: "No data"
  }
};

/**
 * Flagship "kid food speed" badge — the loudest element on a detail page.
 */
function SpeedBadge({
  minutes,
  tier = "fast",
  caption,
  meta,
  style
}) {
  const t = TIERS[tier] || TIERS.fast;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FBF8F0",
      border: "1px solid #EFE6D3",
      borderRadius: "var(--ls-radius-lg)",
      padding: 16,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 800,
      fontSize: 10,
      letterSpacing: "var(--ls-tracking-label)",
      textTransform: "uppercase",
      color: "var(--ls-ink-muted)",
      marginBottom: 8
    }
  }, caption || "Kid food speed"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: t.color,
      boxShadow: `0 0 0 4px ${t.soft}`
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-display)",
      fontWeight: 700,
      fontSize: 38,
      lineHeight: 1,
      color: "var(--ls-ink)"
    }
  }, minutes != null ? `${minutes} min` : "—"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-display)",
      fontWeight: 700,
      fontSize: 13,
      color: t.color,
      background: t.soft,
      padding: "5px 11px",
      borderRadius: "var(--ls-radius-full)"
    }
  }, t.label)), meta ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 600,
      fontSize: 12,
      color: "var(--ls-ink-muted)",
      marginTop: 8
    }
  }, meta) : null);
}
Object.assign(__ds_scope, { SpeedBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SpeedBadge.jsx", error: String((e && e.message) || e) }); }

// components/core/Toggle.jsx
try { (() => {
/**
 * Rounded pill toggle in brand sky / ivory track.
 */
function Toggle({
  checked = false,
  onChange,
  label,
  style
}) {
  const track = /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": checked,
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 42,
      height: 24,
      borderRadius: "var(--ls-radius-full)",
      background: checked ? "var(--ls-sky)" : "var(--ls-border-strong)",
      position: "relative",
      flex: "none",
      cursor: "pointer",
      transition: "background var(--ls-dur-fast) var(--ls-ease-out)",
      boxShadow: "inset 0 1px 2px rgba(0,0,0,.15)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: checked ? 21 : 3,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 2px rgba(0,0,0,.2)",
      transition: "left var(--ls-dur-fast) var(--ls-ease-out)"
    }
  }));
  if (!label) return track;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      ...style
    }
  }, track, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 700,
      fontSize: 13,
      color: "var(--ls-ink)"
    }
  }, label));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/core/UpdateCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DOT = {
  fast: "var(--ls-ttf-fast)",
  ok: "var(--ls-ttf-ok)",
  slow: "var(--ls-ttf-slow)",
  none: "var(--ls-ttf-none)"
};

/**
 * Feed card for an update on a saved spot.
 */
function UpdateCard({
  name,
  tier = "fast",
  time,
  children,
  isNew = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--ls-surface)",
      border: "1px solid #EFE6D3",
      borderRadius: "var(--ls-radius-lg)",
      padding: 13,
      boxShadow: "var(--ls-shadow-sm)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: DOT[tier]
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-display)",
      fontWeight: 700,
      fontSize: 13,
      color: "var(--ls-ink)"
    }
  }, name), isNew ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 700,
      fontSize: 10,
      color: "var(--ls-pop)",
      background: "var(--ls-pop-soft)",
      padding: "2px 8px",
      borderRadius: "var(--ls-radius-full)",
      marginLeft: "auto"
    }
  }, "New") : time ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 700,
      fontSize: 11,
      color: "var(--ls-ink-muted)",
      marginLeft: "auto"
    }
  }, time) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ls-font-body)",
      fontWeight: 600,
      fontSize: 12.5,
      color: "#5E5446",
      lineHeight: 1.4
    }
  }, children));
}
Object.assign(__ds_scope, { UpdateCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/UpdateCard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AttributeChip = __ds_scope.AttributeChip;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.BottomNav = __ds_scope.BottomNav;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.RestaurantListCard = __ds_scope.RestaurantListCard;

__ds_ns.SpeedBadge = __ds_scope.SpeedBadge;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.UpdateCard = __ds_scope.UpdateCard;

})();
