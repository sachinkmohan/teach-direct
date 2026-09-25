import { addMinutes } from "date-fns";
import FullCalendar from "@fullcalendar/react";
import type { EventInput } from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { LessonEventBlock } from "./LessonEventBlock";
import type { LessonWithDetails } from "@/hooks/useLessons";

interface LessonCalendarProps {
  lessons: LessonWithDetails[];
  userTimezone: string;
  userRole: "student" | "teacher";
}

// Pure mapping: one lesson row -> one FullCalendar event. No timezone
// conversion happens here - FullCalendar positions start/end (raw UTC
// instants) correctly on its own once `timeZone` is set on the calendar.
function lessonToEvent(
  lesson: LessonWithDetails,
  userRole: "student" | "teacher",
): EventInput {
  const otherParty = userRole === "student" ? lesson.teacher : lesson.student;
  const otherPartyName =
    otherParty?.display_name || otherParty?.email || "Unknown";

  const start = lesson.scheduled_at;
  const end = addMinutes(
    new Date(lesson.scheduled_at),
    lesson.duration_minutes,
  ).toISOString();

  return {
    id: lesson.id,
    start,
    end,
    extendedProps: {
      otherPartyName,
      status: lesson.status,
    },
  };
}

export function LessonCalendar({
  lessons,
  userTimezone,
  userRole,
}: LessonCalendarProps) {
  const events = lessons.map((lesson) => lessonToEvent(lesson, userRole));

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        firstDay={0}
        timeZone={userTimezone}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        events={events}
        eventContent={LessonEventBlock}
        height="auto"
        nowIndicator
        allDaySlot={false}
      />
    </div>
  );
}
