# Still Point user manual

Still Point turns a Polar H10 chest strap into a calm morning check-in. A short reading each day tracks your heart rate
variability (HRV) against your own usual range, an optional standing test adds how your heart rate responds to getting up,
and a breathing guide helps you slow down. It is free, needs no account, and nothing leaves your device.

> **For general wellness only. Still Point is not a medical device.**
>
> If you feel unwell, with chest pain or pressure, fainting, severe shortness of breath, or a racing or very irregular
> heartbeat, **call your local emergency number now.**

## Wellness use only
Still Point is for **general wellness, training and relaxation**. It has not been tested, cleared or approved by any medical
regulator. Do not use it to diagnose, rule out or monitor any illness, or to make decisions about medicines or treatment.
Words such as "usual range" describe how a reading compares with **your own** earlier readings. They are not medical findings.

Slow breathing can make some people light-headed. If that happens, stop and breathe normally. If you are pregnant or have a
heart, lung or blood-pressure condition, check with your doctor before slow-breathing practice. Do the standing test only
where you can sit down straight away.

## What you need
- A **Polar H10** chest strap (a Polar H9 also works).
- **Google Chrome or Chromium on Android.** On a computer, Chrome or Edge. iPhone, iPad, Safari and Firefox cannot connect to the strap.
- The app opened from its https address: https://stillpoint.anonacondacodelab.com

No strap to hand? Choose any reading and, where it asks you to connect your strap, tap **try a simulated strap**. It produces made-up heart beats so you can explore the app.
At the end of a reading, tap **Discard** so made-up readings stay out of your history.

## Choosing what to do
The **HRV** tab (the first tab) asks what you'd like to do:
- **Morning reading**: the daily check-in that builds your baseline.
- **Morning reading + standing test**: the same reading, then you stand up for 2 minutes (see below).
- **Spot check**: a reading at any other time. It is saved and charted but never changes your baseline, because HRV
  naturally runs lower later in the day.
- **Breathe**: the breathing guide.

## The morning reading
1. Moisten the electrodes, put the strap on and close other apps connected to it.
2. On the **HRV** tab, tap **Connect H10** and choose your strap.
3. Choose **Morning reading**, then your **position** and **reading length**. Two minutes is plenty; use the same
   choices every day. The app remembers them.
4. Tap **Begin**. The first 15 seconds let you settle; if you're already still and ready, tap **Skip settling**. Then
   the reading runs. Stay still and breathe normally.

While it runs you see a live **heart-rate trace** of the last minute, beat by beat, and your heart rate, your **HRV**
(RMSSD over the last minute), your **breathing rate** and the signal quality. In the trace, the area above your average
is shaded teal where your heart speeds up (usually as you breathe in) and lavender where it slows (as you breathe out),
so each breath shows as a gentle wave: taller waves mean higher HRV. Beats left out as glitches appear as small grey
rings off the line. In the standing test, a dashed line marks the moment you stood up. HRV and breathing appear after about half a minute and update every couple of seconds. Don't try to
steer them: just breathe normally.
5. When it finishes, look over the result and tap **Save reading**, or **Discard** if something went wrong (you moved,
   talked, or it wasn't your usual routine).

**Get the most from it:** read at the same time each morning, soon after waking, after the bathroom and before coffee,
food or exercise, in the same position. Consistency matters far more than the exact routine you choose.

### Your result
- **HRV score**: lnRMSSD on a 0–100 scale (lnRMSSD × 100 / 6.5). Several apps use a similar scale, but the numbers are
  not interchangeable between apps.
- **lnRMSSD** and **RMSSD**: the standard short-reading HRV measure, from the strap's own beat-to-beat intervals.
- **Heart rate**: average over the reading.
- **Breathing**: about how many breaths a minute you took (3 to 30). It is estimated from your heart rhythm, which rises and falls
  slightly with each breath, so it is approximate and may be missing if your rhythm didn't show a clear pattern.
- **Signal**: beats that differ by more than 20 % from their neighbours (a missed or extra beat, or a strap glitch) are
  left out. If more than 10 % are left out, the reading is marked noisy and does not count towards your baseline.

### Your reading, beat by beat
Every result shows the whole reading as a heart-rate trace with the same teal and lavender shading (the faded strip at
the start is the settle period). A standing test gets its own trace with the moment you stood up and your peak heart
rate marked.

Next to it, the **beat-to-beat pattern** plots each beat against the next (a Poincaré plot). A wide, round cloud means
a lot of variation from beat to beat (higher HRV); a narrow cloud along the diagonal means less. Grey rings are beats
that were left out.

### Breathing and HRV
How you breathe moves HRV: slow, deep breathing raises it and faster breathing lowers it. So breathe the way you
usually do during readings, whether that's normal or naturally slow. If a morning reading was breathed much faster or
slower than your usual (by more than about half again), the result says so, so you don't mistake a change in breathing
for a change in you.

### What this means
Under every result, a short **What this means** section explains in everyday words what HRV is, what today's reading
suggests and what, if anything, to do about it. Once your baseline is ready it also gives some context: where your usual
value sits compared with published averages for healthy adults (roughly 20 to 75 ms RMSSD lying down, falling with age).

The app deliberately doesn't grade HRV as *favourable*, *normal*, *borderline* or *outside normal range* the way Lead One
ECG grades ECG measurements. Healthy people of the same age can differ two- or threefold in HRV, mostly because of
genetics, so a population grade would worry people with naturally low HRV for nothing and reassure people with high HRV
even when their own trend is sliding. Comparing you with your own usual range is what the research supports.

### Your baseline
HRV varies a lot between people, so a single number means little. After **7 earlier mornings** in the same position,
each reading is compared with your own usual range:
- **Usual range** is your 60-day average ± half a standard deviation of your daily values.
- Your **7-day average** is compared with it, because day-to-day values bounce around.
- **In your usual range**: nothing stands out.
- **Lower than usual**: often follows hard training, short or poor sleep, alcohol, illness, travel or stress.
  An easier day and an early night are sensible.
- **Higher than usual**: usually good recovery; occasionally, with unusual tiredness after very heavy training, a sign of
  being run down.

Only the first good reading of each day counts, and each position has its own baseline.

### Training guidance
Once your baseline is ready, morning results include a suggestion for today's training, based on the published
HRV-guided training approach (Kiviniemi 2007, Plews 2013):
- **Go as planned**, or **Good day for a harder session** when you are above your usual range and today isn't low.
- **Keep it easy**: your 7-day average is below your usual range, or today is clearly lower than your usual.
- **Rest or very light**: today is well below your usual *and* either your week is low or your resting heart rate is
  5 or more beats up.

It's a suggestion: how you feel counts too. Switch it off in **Settings → Options** if you don't train.

### Tags (optional)
Under each result, **+ Add tags** lets you note anything that may have affected the reading: slept badly or well,
alcohol last night, hard training or a rest day yesterday, sore muscles, feeling ill, stressed, a late or heavy meal,
caffeine before the reading, travel or jet lag, period. You can also enter a **sleep score** (0–100, as shown by a
Garmin, Oura, Fitbit or similar), **hours slept** and any **sleep aids** you took the night before (herbal or other,
such as magnesium or chamomile tea; separate several with commas). Aids you've used before appear as buttons, so
they're one tap next time. Tags are entirely optional; you can add or change them later by
opening the reading.

### Something about skipped beats
If several of your recent readings (3 of the last 7) had beats left out even though the signal was good, the result
suggests recording with **Lead One ECG**, our ECG app, which shows the actual heart trace from the same strap so you can
see whether the odd beats were the strap or real early beats. Occasional early or skipped beats are common and usually
harmless; if you have symptoms such as palpitations, dizziness or chest discomfort, see a doctor.

## The standing test
Choose **Morning reading + standing test** (from lying or sitting). It uses your morning position and length, so the
reading part joins your baseline as usual. After the reading, a chime asks you to **stand up
calmly** and stay standing, still, for 2 minutes. You'll see:
- **Peak after standing**: your highest heart rate in the first 30 seconds, and how far it rose.
- **Standing, last minute**: where your heart rate settled, compared with lying or sitting.
- **30:15 ratio**: the longest beat interval around the 30th beat after standing divided by the shortest around the 15th.
  It reflects how quickly your heart rate comes back down after the initial jump.

Compare these with your own earlier tests; Trends charts them over time.

## Breathe
Choose a **rhythm** and a length:
- **Longer out** (40 % in, 60 % out, the more relaxing choice) or **Even**, with a **pace** from 3 to 7 breaths a minute
  in half steps.
- **Box 4-4-4-4**: in 4 s, hold 4 s, out 4 s, hold 4 s.
- **4-7-8**: in 4 s, hold 7 s, out 8 s.
- **Custom**: set your own breath in, hold, breath out and hold, from 1 to 20 seconds (holds from 0) in half-second steps.

 Follow the circle: it grows as you breathe in and shrinks as you breathe out,
with a soft chime at each change if you like. Breathe gently through your nose into your belly. Don't force the breath;
if you feel short of air, choose a faster pace.

With the strap connected you'll see your heart rate rise as you breathe in and fall as you breathe out, and the size of
that **swing** per breath.

### Find your resonance pace
At one particular pace, usually between 4.5 and 6.5 breaths a minute, the swing is largest. The test guides you through
6.5, 6, 5.5, 5 and 4.5 breaths a minute for two minutes each and picks the pace with the biggest swing. Tap
**Use … as my pace** to make it your default; it is marked with a dot among the pace buttons. Retest every month or two.

### Open session
No guide and no counting: sit or lie comfortably, breathe naturally and let your mind settle. Choose open-ended or a
length from 5 to 30 minutes (a soft chime marks the end). With the strap on, your heart rate and HRV are shown quietly,
and the summary compares your first and last two minutes: as you settle, heart rate usually drifts down and HRV up.

## Trends and history
**Trends** shows the last 60 days: HRV score with your 7-day average and usual range, resting heart rate, standing-test
results, spot checks and your breathing and open-session minutes. Tap any item in the history to open it.

### This week and your weekly recap
**This week** on Trends sums up the current week (Monday to Sunday): morning readings, average HRV score and resting
heart rate compared with the week before, standing tests, breathing and open-session minutes, and your most-used tag.
At the start of each week, the HRV tab shows **Your week**, the same summary for the week just finished, until you tap
**Got it**.

### What affects you
Once you've tagged some mornings, this card shows how each tag relates to your HRV, for example "Alcohol last night:
HRV about 12 % lower than on other mornings". Each sleep aid is compared the same way as a tag. A tag needs at least **3 mornings with it and 5 without**; sleep score
and hours slept need **8 mornings** and compare your lower half with your upper half. Only differences of 5 % or more
are listed. These are patterns in your own readings, not proof of cause.

### What your trend shows
Once your baseline is ready, the top of Trends comments on the last few weeks in plain language. A green dot is
reassuring, an orange dot is worth noticing, and a grey dot is about how the readings are taken. It looks at:
- **Direction**: whether your 7-day average is below or above your usual range, and for how many days, or slowly
  drifting over two weeks.
- **Day-to-day variation**: readings that jump around more than usual are often an early sign of strain, before the
  average itself drops.
- **Heart rate and HRV together**: resting heart rate up while HRV is down is a clearer sign of strain than either alone.
- **Standing test**: whether your heart-rate jump on standing has been bigger lately than it usually is.
- **Consistency**: missed mornings, or readings at very different times of day, which make the comparison less reliable.

**When comments appear:** from your **8th morning reading** in the same position (7 earlier mornings plus today).
Some need more: "drifting up/down" about two weeks of mornings, "more up-and-down than usual" at least 5 readings in
the last week, "heart rate up, HRV down" at least 4 readings in the last week, and "bigger jump on standing" at least
6 standing tests. They are general wellness information, not medical advice.

## Your data
Nothing is kept until you tap **Save**. Saved readings and sessions are stored in this browser on this device.
- **Save to file** (open any saved reading) saves that one reading, with all its beat-to-beat intervals, as a file.
- **Save all to file** (Settings, or the **Save all** button above the history list on Trends) saves every reading and
  breathing session, with all their beat intervals, in one backup file.
- **Save as spreadsheet** (Settings, or **Spreadsheet** on Trends) saves a CSV file with one row per reading and session:
  date, time, type, position, score, lnRMSSD, RMSSD, SDNN, heart rate, breathing rate, signal quality, standing-test
  results, and pace and swing for breathing. It opens in Excel, Google Sheets or LibreOffice. It is a summary, so it
  can't be imported back; keep the backup file for that.
- **Settings → Import history** brings a history file or a single reading file back in, for example on a new phone.
  Clearing the browser's site data deletes everything, so save a backup from time to time.

### Moving from Elite HRV
In Elite HRV, request your data export; you'll get a download link by email. Download the .zip, then in
**Settings → Import from Elite HRV** choose that .zip (or the .txt files inside it, one per reading). Pick the position
you took your readings in.
- Readings before 11:00 that last up to 5½ minutes become morning readings; later or longer ones (open readings,
  meditations, guided breathing) become spot checks, so they can't skew your baseline. You can switch this off.
- Everything is recalculated from the beat intervals with Still Point's own method, so old and new readings are measured
  the same way and your baseline and trends are ready straight away. On clean readings the score matches Elite's HRV
  number; on readings with a skipped or extra beat it can differ by a few points, because the two apps handle such
  beats differently.
- Imported readings are marked **from Elite HRV**. If a batch went in with the wrong position, **Remove all Elite HRV
  imports** in the same place takes them out again. Elite's tags and moods aren't in the export, so they don't come across.

**After you switch**, once you have 5 mornings in Still Point, Trends compares them with your last Elite HRV mornings.
If they line up, it says so. If there's a clear step, usually from a change in routine such as breathing, position, time
or reading length, it explains this and offers **Start my baseline from** the switch date, so the old routine doesn't
skew your baseline. Old readings stay in your history and charts, and you can go back to your full history at any time.

## Install as an app
In Chrome on Android, the HRV tab offers **Install** (also in **Settings → Options**, or Chrome's menu →
**Add to Home screen** / **Install app**). It then has its own icon, opens full screen and works without a connection;
Bluetooth still needs Chrome underneath, which it uses automatically. Your readings stay the same: the installed app
and the web page share the same storage.

## Troubleshooting
- **Connect does nothing or the strap isn't listed:** close Polar Beat, Polar Flow and other apps using the strap, make
  sure the strap is worn and moist (it sleeps when dry), and that Bluetooth and location are on.
- **Noisy reading:** moisten the electrodes, tighten the strap a little, keep still and don't talk.
- **The screen turns off during a session:** the app asks the phone to stay awake; keep the page in the foreground.
