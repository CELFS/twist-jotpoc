
import { getDaysInMonth, parseISO } from "date-fns";
import { useMemo } from "react";
import { getIntlLocale } from "@/i18n/app-language";
import { getText } from "@/i18n/get-text";

const dateFormatPattern = /^\d{4}-\d{2}-\d{2}$/;

type DateWheelPrecision = "date" | "month";

export type DateWheelPickerProps = {
  className?: string;
  max?: string;
  min?: string;
  hideUnavailableMonths?: boolean;
  onValueChange: (value: string) => void;
  precision?: DateWheelPrecision;
  value: string;
};

function padPart(value: number) {
  return String(value).padStart(2, "0");
}

function toDateValue(year: number, month: number, day: number) {
  return `${year}-${padPart(month)}-${padPart(day)}`;
}

function getDateParts(value: string) {
  const parsed = dateFormatPattern.test(value)
    ? parseISO(value)
    : new Date();

  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
  };
}

function getBoundaryDate(value?: string) {
  const date = value?.slice(0, 10);
  return date && dateFormatPattern.test(date) ? date : undefined;
}

export function DateWheelPicker({
  className = "",
  max,
  min,
  hideUnavailableMonths = false,
  onValueChange,
  precision = "date",
  value,
}: DateWheelPickerProps) {
  const { day, month, year } = getDateParts(value);
  const minDate = getBoundaryDate(min);
  const maxDate = getBoundaryDate(max);
  const minYear = minDate ? Number(minDate.slice(0, 4)) : year - 50;
  const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : year + 50;
  const years = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, maxYear - minYear + 1) },
        (_, index) => minYear + index,
      ),
    [maxYear, minYear],
  );
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  );
  const dayCount = getDaysInMonth(new Date(year, month - 1, 1));
  const safeDay = Math.min(day, dayCount);
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => index + 1),
    [dayCount],
  );

  const changeValue = (
    nextYear: number,
    nextMonth: number,
    nextDay: number,
  ) => {
    const nextDayCount = getDaysInMonth(
      new Date(nextYear, nextMonth - 1, 1),
    );
    let nextValue = toDateValue(
      nextYear,
      nextMonth,
      precision === "month"
        ? 1
        : Math.min(nextDay, nextDayCount),
    );

    if (precision === "date" && minDate && nextValue < minDate) {
      nextValue = minDate;
    }

    if (precision === "date" && maxDate && nextValue > maxDate) {
      nextValue = maxDate;
    }

    onValueChange(nextValue);
  };

  return (
    <div
      className={["ui-date-wheels", className]
        .filter(Boolean)
        .join(" ")}
      data-columns={precision === "month" ? 2 : 3}
    >
      <label>
        <span className="visually-hidden">
          {getText("datePicker.year")}
        </span>
        <select
          className="no-scrollbar"
          size={3}
          value={year}
          onChange={(event) => {
            const nextYear = Number(event.target.value);
            let nextMonth = month;

            if (
              minDate &&
              nextYear === minYear &&
              nextMonth < Number(minDate.slice(5, 7))
            ) {
              nextMonth = Number(minDate.slice(5, 7));
            }

            if (
              maxDate &&
              nextYear === maxYear &&
              nextMonth > Number(maxDate.slice(5, 7))
            ) {
              nextMonth = Number(maxDate.slice(5, 7));
            }

            changeValue(nextYear, nextMonth, safeDay);
          }}
        >
          {years.map((optionYear) => (
            <option key={optionYear} value={optionYear}>
              {new Intl.DateTimeFormat(getIntlLocale(), {
                year: "numeric",
              }).format(new Date(optionYear, 0, 1))}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="visually-hidden">
          {getText("datePicker.month")}
        </span>
        <select
          className="no-scrollbar"
          size={3}
          value={month}
          onChange={(event) =>
            changeValue(year, Number(event.target.value), safeDay)
          }
        >
          {months.map((optionMonth) => {
            const monthKey = `${year}-${padPart(optionMonth)}`;
            const disabled =
              (minDate !== undefined &&
                monthKey < minDate.slice(0, 7)) ||
              (maxDate !== undefined &&
                monthKey > maxDate.slice(0, 7));

            if (hideUnavailableMonths && disabled) return null;

            return (
              <option
                disabled={disabled}
                key={optionMonth}
                value={optionMonth}
              >
                {new Intl.DateTimeFormat(getIntlLocale(), {
                  month: "2-digit",
                }).format(new Date(2026, optionMonth - 1, 1))}
              </option>
            );
          })}
        </select>
      </label>
      {precision === "date" ? (
        <label>
          <span className="visually-hidden">
            {getText("datePicker.day")}
          </span>
          <select
            className="no-scrollbar"
            size={3}
            value={safeDay}
            onChange={(event) =>
              changeValue(year, month, Number(event.target.value))
            }
          >
            {days.map((optionDay) => {
              const dateKey = toDateValue(year, month, optionDay);
              const disabled =
                (minDate !== undefined && dateKey < minDate) ||
                (maxDate !== undefined && dateKey > maxDate);

              return (
                <option
                  disabled={disabled}
                  key={optionDay}
                  value={optionDay}
                >
                  {new Intl.DateTimeFormat(getIntlLocale(), {
                    day: "2-digit",
                  }).format(new Date(2026, 0, optionDay))}
                </option>
              );
            })}
          </select>
        </label>
      ) : null}
    </div>
  );
}
