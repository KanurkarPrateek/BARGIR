# Biometric machines

Works with eSSL, ZKTeco and BioMax machines that have the **Cloud Server /
ADMS ("push")** feature. The machine sends each punch to the software within
seconds and picks up instructions (add, block, delete a person) about once a
minute.

## Connecting a machine

1. **Biometric Management → Machine Setup** shows the server address and port.
2. On the machine: **Menu → Comm. → Cloud Server Setting** (or *ADMS*):
   - Server address and port: as shown.
   - Enable domain name: **On** if the address is a name, **Off** for an IP.
   - HTTPS: Off, unless your hosting needs it (see below).
3. In the software, **Add machine** with the serial number from the sticker on
   the back (or Menu → System Info → Device Info).
4. Within a minute the machine shows as **Connected**.

Every gym's machine can use the same address; the serial number tells the
software which gym the punches belong to. A machine nobody has added is
refused, and it keeps its punches until it is added.

**Hosted on Vercel?** Vercel accepts HTTPS only, and many machines can only do
plain HTTP. Either switch HTTPS on in the machine (if it has the option, port
443), or put the free relay in `tools/cloudflare-biometric-relay.js` in front.
See [DEPLOY.md](../DEPLOY.md#5-biometric-machines).

**No network, or no Cloud Server menu?** Use *Import from a pen drive* under
Machine Setup with the attendance file from Menu → USB Manager → Download.

## Daily use

| Task | Where | Notes |
|---|---|---|
| Put a new member on the machine | Add Biometric, or **Enroll** in View Member / the member's profile | The software picks the next free machine ID and sends the name. Then enroll the finger **on the machine**: User Management → find the ID → enroll. |
| Put staff on the machine | Add Biometric → Add staff | Their punches fill in Staff Attendance (first = in, last = out). |
| Stop someone getting in | Block Biometric, or **Block** on their profile | Removes them from the machine. Their fingerprint is deleted there. |
| Let them back in | **Unblock** | Sends them back; they enroll the finger again. |
| Remove completely | Delete Biometric | Removes them and frees the machine ID. Past attendance stays. |
| Machine already has people | Add Biometric → **Get people from machine**, then **Link IDs** | Pick the member for each machine ID once. |
| Check an instruction worked | View Commands | *Waiting for machine → Sent to machine → Done* (or *Failed* with the machine's code). |

**Block automatically when membership ends** (Block tab, owner): members whose
membership has ended are taken off the machine within a few minutes, and put
back when they renew. Members who never bought a package are left alone.

**BlackList** on a member's profile also takes them off the machine, and refuses
manual check-in.

## How punches become attendance

- Members: the **first punch of the day** is their attendance. Later punches that
  day are ignored.
- Staff: first punch = time in, last punch = time out (if at least 5 minutes later).
- A machine ID nobody is linked to waits under **Link IDs**; linking it marks the
  waiting punches straight away.
- Machine IDs are never guessed from member codes; an ID only counts once linked.
- New machine IDs skip numbers already seen on the machine, so an old person's
  punches are never credited to someone new.

## Testing without a machine

`tools/biometric-simulator/simulator.mjs` behaves like a push machine: it
connects, uploads stored punches, obeys add / remove / list commands, and
refuses punches from people who are not on it.

```bash
npm run simulate:biometric -- --server http://localhost:3000 --serial TEST-001 --heartbeat 5
```

Add `TEST-001` under Machine Setup, then type a machine ID and press Enter in
the simulator to punch as that person. `--help` lists every option.

## What is and isn't proven

- **Tested:** the whole flow above against the simulator, in the automated browser
  tests (`npm run test:e2e`).
- **Not yet tested on real hardware:** the exact add/remove command format is the
  one documented for ZKTeco-family push devices and confirmed on real ZKTeco
  units by others, but has not been tried on a BioMax. Check **View Commands**
  after the first Enroll on a real machine: *Done* means it worked.
- There is no reliable non-destructive "disable" command across these machines,
  which is why Block removes the person.
