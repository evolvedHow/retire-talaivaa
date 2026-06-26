<script lang="ts">
  import { comparisonStore } from '../../stores/comparison';

  let open = false;

  $: c = $comparisonStore;
  $: paysMoreTax = c != null && c.delta.lifetimeTaxNPV > 0;
  $: gainsNW = c != null && c.delta.endingTotalBalanceReal > 0;
  $: worthIt = c != null && gainsNW; // headline judgment
</script>

<div class="howto" class:open>
  <button class="toggle" on:click={() => open = !open} aria-expanded={open}>
    <span class="caret">{open ? '▼' : '▶'}</span>
    <span class="lbl">How to read this</span>
    {#if c}
      <span class="verdict" class:good={worthIt} class:bad={c.delta.endingTotalBalanceReal < 0 && c.delta.lifetimeTaxNPV > 0}>
        {#if worthIt && paysMoreTax}
          ✓ Pays more tax now, ends up richer — worth it
        {:else if worthIt && !paysMoreTax}
          ✓ Less tax AND more wealth — clear win
        {:else if !worthIt && paysMoreTax}
          ✗ More tax AND less wealth — strategy isn't paying off
        {:else if c}
          ~ Less tax but less wealth — your call
        {/if}
      </span>
    {/if}
  </button>

  {#if open}
    <div class="body">
      <h4>What each card means</h4>
      <dl>
        <dt>Lifetime Tax NPV (today's $)</dt>
        <dd>
          Sum of every dollar of federal + state + IRMAA you'll pay across the entire plan,
          deflated back to today's purchasing power and NPV-discounted. <strong>Lower is better in isolation.</strong>
          But — and this is the catch — Roth conversions almost always <em>raise</em> this number on
          the "with strategy" side, because you're voluntarily paying tax now on the conversion.
        </dd>

        <dt>Terminal real net worth (today's $)</dt>
        <dd>
          What's left in all your accounts at the end of the plan, in today's dollars.
          <strong>Higher is better.</strong> Conversions feed the Roth, which then compounds tax-free —
          so even though you pay more tax upfront, the post-tax wealth at the end can be much larger.
        </dd>

        <dt>Lifetime IRMAA surcharge</dt>
        <dd>
          Medicare Part B + D premium add-ons triggered when MAGI crosses tier thresholds (with a
          2-year lookback). Big conversion years can push you into higher IRMAA tiers <em>two years later</em>.
          A well-tuned conversion strategy keeps this low; an aggressive one can spike it.
        </dd>
      </dl>

      <h4>Why "lifetime tax goes up" can still be the right move</h4>
      <p>
        The whole point of Roth conversions is to <strong>trade present tax for future tax</strong>.
        You pay tax now at a known rate (say 22% or 24%) in exchange for:
      </p>
      <ul>
        <li>Tax-free growth on the converted balance (Roth never gets taxed again).</li>
        <li>Smaller future RMDs — your tax-deferred balance is lower, so forced withdrawals are smaller.</li>
        <li>Less SS income gets dragged into taxable range later.</li>
        <li>Potentially lower IRMAA tiers in your 70s and 80s.</li>
      </ul>
      <p>
        So when you see <strong>+$89k lifetime tax but +$1.1M terminal NW</strong>, that's the strategy working:
        you "spent" $89k more in tax (today's dollars) to end up with $1.1M more wealth. That's the
        textbook "good conversion" pattern.
      </p>

      <h4>The judgment call</h4>
      <p>
        Look at terminal real NW first — that's whether the strategy made you wealthier. Use lifetime
        tax NPV to understand the <em>cost</em> of getting there. The <strong>Sweet Spot chart</strong>
        below shows where this trade-off is most favorable — the green band is where you maximize wealth
        for an acceptable tax cost. Crank the conversion slider too high and you start overpaying tax
        without enough wealth gain (IRMAA hits, bracket overflow); too low and RMDs eat you alive later.
      </p>
    </div>
  {/if}
</div>

<style>
  .howto {
    background: white;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 12px;
    border-left: 4px solid #2a4d8f;
  }
  .toggle {
    width: 100%;
    text-align: left;
    background: none; border: none;
    padding: 10px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .toggle:hover { background: #f8fafc; }
  .caret { color: #2a4d8f; font-size: 11px; }
  .lbl { font-weight: 700; color: #2a4d8f; text-transform: uppercase; letter-spacing: 0.4px; font-size: 12px; }
  .verdict {
    margin-left: auto;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11.5px;
    font-weight: 600;
    background: #f1f5f9;
    color: #475569;
  }
  .verdict.good { background: #ecfdf5; color: #047857; }
  .verdict.bad { background: #fef2f2; color: #b91c1c; }
  .body {
    padding: 4px 16px 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 13px;
    color: #334155;
    line-height: 1.55;
  }
  .body h4 {
    font-size: 12px;
    font-weight: 700;
    color: #2a4d8f;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-top: 14px;
    margin-bottom: 6px;
  }
  .body h4:first-child { margin-top: 6px; }
  dl { margin: 0; }
  dt { font-weight: 700; color: #1e3a8a; margin-top: 8px; font-size: 13px; }
  dd { margin: 2px 0 6px; padding-left: 0; }
  ul { padding-left: 20px; margin: 4px 0; }
  li { margin-bottom: 3px; }
  p { margin: 4px 0; }
  em { color: #475569; }
</style>
