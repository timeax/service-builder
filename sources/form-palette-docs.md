# Index
- [Form Palette](#form-palette)
    - [Quick start](#quick-start)
    - [Form](#form)
    - [InputField](#inputfield)
    - [Adapters](#adapters)
    - [Recommended boot order](#recommended-boot-order)
- [Variant props + InputField usage](#variant-props-inputfield-usage)
    - [text](#text)
    - [textarea](#textarea)
    - [toggle-group](#toggle-group)
    - [number](#number)
    - [password](#password)
    - [phone](#phone)
    - [Slider (`slider`)](#slider-slider)
    - [Toggle (`toggle`)](#toggle-toggle)
    - [TreeSelect (`treeselect`)](#treeselect-treeselect)
    - [multi-select](#multi-select)
    - [radio](#radio)
    - [select](#select)
    - [checkbox](#checkbox)
    - [chips](#chips)
    - [color](#color)
    - [date](#date)
    - [keyvalue](#keyvalue)
    - [editor](#editor)
    - [file](#file)
    - [icon](#icon)
    - [image-icon](#image-icon)
    - [json-editor](#json-editor)
    - [lister](#lister)
    - [custom](#custom)
- [Form Palette - `extra` entrypoint (v2)](#form-palette-extra-entrypoint-v2)
- [1) Lister (runtime)](#1-lister-runtime)
    - [What is Lister?](#what-is-lister)
    - [Building blocks (what you actually mount/call)](#building-blocks-what-you-actually-mountcall)
    - [Quick start (recommended)](#quick-start-recommended)
    - [`ListerProvider` API](#listerprovider-api)
- [2) `useData()` - deep dive (extremely important)](#2-usedata-deep-dive-extremely-important)
    - [`UseDataOptions` (inputs)](#usedataoptions-inputs)
    - [Search modes: remote vs local vs hybrid](#search-modes-remote-vs-local-vs-hybrid)
    - [Search targeting (`searchTarget`)](#search-targeting-searchtarget)
    - [Core returned API (what you'll use most)](#core-returned-api-what-youll-use-most)
    - [`useData()` - practical use cases (full examples)](#usedata-practical-use-cases-full-examples)
    - [Practical tips](#practical-tips)
- [3) JsonEditor (overview)](#3-jsoneditor-overview)
    - [Standalone usage](#standalone-usage)

# Form Palette

A small but powerful React form runtime built around three ideas:

1. **A single `<Form />` shell** that wires up state, submission and validation.
2. **`<InputField />`** as the universal â€œfield wrapperâ€ that renders a registered **variant** (text, number, select, json-editor, etc.) and handles label / description / errors / layout.
3. **Adapters** that decide what â€œsubmitâ€ means (`local`, `axios`, `inertia`, or your own).

---

## Quick start

#### Installation:

```bash
npm install @timeax/form-palette
```

---

```tsx
import * as React from "react";
import {
    Form,
    InputField,
    registerCoreVariants,
    registerAxiosAdapter,
    registerInertiaAdapter,
} from "@timeax/form-palette";

// App boot (once)
registerCoreVariants();
registerAxiosAdapter();
await registerInertiaAdapter();
```

> If you only use one adapter, only register the one you need.

---

## Form

`Form` is the main form component exported from the package entrypoint (it is `CoreShell`, re-exported as `Form`).

### Minimal â€œlocalâ€ form

Use `adapter="local"` when you want submission to be handled purely in JS.

```tsx
function Example() {
    return (
        <Form
            name="profile"
            adapter="local"
            onSubmit={(e) => {
                // Current outbound snapshot
                console.log(e.formData);
                // You can also mutate outbound data via e.editData(...)
            }}
        >
            <InputField
                name="email"
                variant="text"
                label="Email"
                required
            />

            <InputField
                name="age"
                variant="number"
                label="Age"
            />

            <button type="submit">Save</button>
        </Form>
    );
}
```

### Axios adapter

```tsx
<Form
    name="profile"
    adapter="axios"
    url="/api/profile"
    method="post"
    onSubmitted={(form, payload) => {
        console.log(payload);
    }}
>
    <InputField name="email" variant="text" label="Email" required />
    <button type="submit">Save</button>
</Form>
```

### Inertia adapter

```tsx
<Form
    name="profile"
    adapter="inertia"
    url="/profile"
    method="post"
    onSubmitted={(form, payload) => {
        // payload is the resolved inertia Page (or normalized error on failure)
        console.log(payload);
    }}
>
    <InputField name="email" variant="text" label="Email" required />
    <button type="submit">Save</button>
</Form>
```

---

## InputField

`InputField` is the form runtimeâ€™s â€œfield wrapperâ€. It:

* Pulls the chosen `variant` from the variant registry and renders it.
* Connects to form state when used inside `<Form />` (by `name`).
* Computes layout (label placement, helper slots, spacing, etc.) by combining:

    * variant defaults
    * host overrides
    * optional `variant.resolveLayout(...)`
* Normalizes validation results into a consistent list of errors.

### Basic usage

```tsx
<InputField
    name="username"
    variant="text"
    label="Username"
    description="Public handle"
    required
    placeholder="@davy"
/>
```

### Helper slots

Most helper UI (description, help text, error text, tags, etc.) is rendered through a layout graph.

```tsx
<InputField
    name="bio"
    variant="textarea"
    label="Bio"
    helpText="Keep it short"
    errorText=""
/>
```

### Standalone mode

`InputField` can run without a surrounding `<Form />` (it will fall back to a self-managed field state).

```tsx
<InputField
    variant="text"
    label="Standalone"
    defaultValue="Hello"
    onChange={({ value }) => {
        console.log(value);
    }}
/>
```

---

## Adapters

Adapters define how the form submits.

### Built-in adapter keys

* `local` â€“ no network; calls your callbacks.
* `axios` â€“ HTTP submit via Axios.
* `inertia` â€“ submit via Inertia.

### Registering adapters

```ts
import { registerAdapter } from "@timeax/form-palette";

registerAdapter("my-adapter", (config) => {
    return {
        submit() {
            // fire-and-forget
        },
        async send() {
            // resolve a result shape that matches AdapterOk<"my-adapter">
            return { data: config.data } as any;
        },
        run() {
            this.submit();
        },
    };
});
```

### Adapter-specific props

Some adapters expose additional props on `<Form />` (e.g. `url`, `method`, `config`).

---

## Recommended boot order

1. Register variants (so InputField can resolve `variant` â†’ component).
2. Register the adapters you will use.
3. Render forms.

```ts
registerCoreVariants();
registerAxiosAdapter();
await registerInertiaAdapter();
```


# Variant props + InputField usage

Below are the **variant-specific props** you can pass to `<InputField />` for:

* `text`
* `textarea`
* `toggle-group`
* `number`
* `phone`
* `password`
* `slider`
* `toggle`
* `treeselect`
* `multi-select`
* `select`
* `radio`
* `checkbox`
* `chips`
* `color`
* `date`
* `keyvalue`
* `editor`
* `file`
* `icon`
* `image-icon`
* `json-editor`
* `lister`
* `custom`

> Note: Some props like `value`, `onValue`, `error`, `disabled`, `readOnly`, `size`, `density` are typically **injected by the core runtime/InputField**. The tables focus on the *props you usually configure*.

---

## text

### Variant props

| Prop                                       | Description                                                                                                                                              |
|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `trim?: boolean`                           | **boolean** â€” If `true`, the value is trimmed **before validation** (visual input stays as typed).                                                     |
| `minLength?: number`                       | **number** â€” Minimum allowed length (after optional trimming).                                                                                         |
| `maxLength?: number`                       | **number** â€” Maximum allowed length (after optional trimming).                                                                                         |
| `joinControls?: boolean`                   | **boolean** â€” If `true` and there are controls, the input + controls share one box (border/radius/focus).                                              |
| `extendBoxToControls?: boolean`            | **boolean** â€” When `joinControls` is true, controls are either visually â€œinsideâ€ the same box (`true`) or separate (`false`).                      |
| `inputClassName?: string`                  | **string** â€” Extra classes for the **inner** `<input>` element (not the wrapper).                                                                      |
| `prefix?: string`                          | **string** â€” Fixed prefix rendered as part of the visible input string (e.g. `â‚¦`, `ID: `).                                                           |
| `suffix?: string`                          | **string** â€” Fixed suffix rendered as part of the visible input string (e.g. `%`, `kg`).                                                               |
| `stripPrefix?: boolean`                    | **boolean** â€” If `true` (default), the prefix is stripped from the emitted model value before calling `onValue` internally.                            |
| `stripSuffix?: boolean`                    | **boolean** â€” If `true` (default), the suffix is stripped from the emitted model value before calling `onValue` internally.                            |
| `mask?: string`                            | **string** â€” Mask pattern (PrimeReact style), e.g. `"99/99/9999"`, `"(999) 999-9999"`.                                                                 |
| `maskDefinitions?: Record<string, RegExp>` | **Record** â€” Per-symbol slot definitions (kept for future custom engine; unused by current implementation).                                            |
| `slotChar?: string`                        | **string** â€” Placeholder slot character (default `_`).                                                                                                 |
| `autoClear?: boolean`                      | **boolean** â€” If `true`, â€œemptyâ€ masked values emit `""` instead of a fully-masked placeholder string.                                             |
| `unmask?: "raw" \| "masked" \| boolean`    | **union** â€” Controls whether the **model value** is raw vs masked. (`"raw"`/`true` â‡’ emit unmasked; `"masked"`/`false`/`undefined` â‡’ emit masked). |
| `maskInsertMode?: "stream" \| "caret"`     | **union** â€” Reserved for future caret-mode logic (currently unused; kept for API compatibility).                                                       |
| `...inputProps`                            | All other standard `React.InputHTMLAttributes<HTMLInputElement>` (except `value`, `defaultValue`, `onChange`, `size`) are forwarded.                     |

### Sample usage (InputField)

```tsx
import { InputField } from "@timeax/form-palette";

export function ExampleText() {
  return (
          <InputField
                  variant="text"
                  name="phone"
                  label="Phone number"
                  description="Weâ€™ll use this for account recovery."

                  // semantic validation flags (core layer)
                  trim
                  minLength={11}
                  maxLength={11}

                  // mask + UI props (preset layer)
                  prefix="+234 "
                  mask="999 999 9999"
                  unmask="raw"
                  autoClear

                  // regular input attributes
                  type="tel"
                  inputMode="tel"
                  placeholder="803 123 4567"
          />
  );
}
```

---

## textarea

### Variant props

| Prop               | Description                                                                                                                                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `...textareaProps` | The textarea variant primarily forwards props from the underlying UI `Textarea` component (`UiTextareaProps`), excluding `value`, `defaultValue`, and `onChange` because the variant emits changes via the form runtime. |

### Sample usage (InputField)

```tsx
import { InputField } from "@timeax/form-palette";

export function ExampleTextarea() {
  return (
          <InputField
                  variant="textarea"
                  name="bio"
                  label="About you"
                  helpText="Keep it short and clear."

                  // typical textarea attributes (usually supported via UiTextareaProps)
                  rows={4}
                  placeholder="Tell us a little about yourself..."
          />
  );
}
```

---

## toggle-group

### Variant props

| Prop                                                       | Description                                                                                                                                                    |
|------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `options: (ToggleOption \| string \| number \| boolean)[]` | Options for the toggle group. You can pass full option objects or primitive shorthand (primitives are normalized to `{ value: String(x), label: String(x) }`). |
| `multiple?: boolean`                                       | **boolean** â€” If `true`, enables multi-select (value becomes an array of strings internally).                                                                |
| `variant?: "default" \| "outline"`                         | **union** â€” Visual style passed to the underlying ToggleGroup.                                                                                               |
| `layout?: "horizontal" \| "vertical" \| "grid"`            | **union** â€” Layout mode.                                                                                                                                     |
| `gridCols?: number`                                        | **number** â€” Column count when `layout="grid"` (defaults to `2` in the component).                                                                           |
| `fillWidth?: boolean`                                      | **boolean** â€” If `true`, makes the group/items stretch to fill available width (adds `w-full` and related item sizing).                                      |
| `optionValue?: string`                                     | **string** â€” When `options` are custom objects, the property name to read `value` from (fallback: `obj.value`).                                              |
| `optionLabel?: string`                                     | **string** â€” When `options` are custom objects, the property name to read `label` from (fallback: `obj.label` or `String(value)`).                           |
| `optionIcon?: string`                                      | **string** â€” When `options` are custom objects, the property name to read `icon` from (fallback: `obj.icon`).                                                |
| `optionDisabled?: string`                                  | **string** â€” When `options` are custom objects, the property name to read disabled flag from (fallback: `obj.disabled`).                                     |
| `optionTooltip?: string`                                   | **string** â€” When `options` are custom objects, the property name to read tooltip content from (fallback: `obj.tooltip`).                                    |
| `optionMeta?: string`                                      | **string** â€” When `options` are custom objects, the property name to read meta from (fallback: `obj.meta`).                                                  |
| `renderOption?: (option, isSelected) => React.ReactNode`   | Custom renderer per option (receives normalized option + selected state).                                                                                      |
| `className?: string`                                       | Class for the toggle group container.                                                                                                                          |
| `itemClassName?: string`                                   | Base class applied to **all** toggle items.                                                                                                                    |
| `activeClassName?: string`                                 | Class applied **only** to selected items (merged with default active styles).                                                                                  |
| `autoCap?: boolean`                                        | If `true`, capitalizes the first letter of string labels.                                                                                                      |
| `gap?: number`                                             | Gap between buttons in **pixels** (applies to flex + grid layouts).                                                                                            |

**ToggleOption shape** (when not using primitive shorthand):

* `label: React.ReactNode`
* `value: string`
* `icon?: React.ReactNode`
* `disabled?: boolean`
* `tooltip?: React.ReactNode`
* `meta?: any`

### Sample usage (InputField)

```tsx
import { InputField } from "@timeax/form-palette";

export function ExampleToggleGroup() {
  return (
          <InputField
                  variant="toggle-group"
                  name="plan"
                  label="Choose a plan"
                  required

                  options={[
                    { value: "basic", label: "Basic" },
                    { value: "pro", label: "Pro" },
                    { value: "team", label: "Team", disabled: true, tooltip: "Coming soon" },
                  ]}
                  layout="horizontal"
                  variant="outline"
                  fillWidth
                  gap={8}
                  activeClassName="ring-1 ring-primary"
          />
  );
}
```

---

## number

| Prop           | Description                                                                                                                                              |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `showButtons`  | When `true`, renders built-in step controls (Â±) alongside the number input.                                                                             |
| `buttonLayout` | Layout for the step controls when `showButtons` is enabled. Supported layouts: `"stacked"` (vertical on the right) and `"inline"` (`-` left, `+` right). |
| `step`         | Step amount used by the built-in controls and stepping logic (forwarded to the underlying number input).                                                 |
| `min`          | Minimum numeric value constraint (used by the stepping logic and forwarded to the underlying number input).                                              |
| `max`          | Maximum numeric value constraint (used by the stepping logic and forwarded to the underlying number input).                                              |

> Also accepts the rest of the underlying `InputNumberProps` (theyâ€™re forwarded to the number input).

**Sample**

```tsx
<InputField
        variant="number"
        name="quantity"
        label="Quantity"
        description="How many items?"
        min={1}
        max={99}
        step={1}
        showButtons
        buttonLayout="inline"
/>
```

---

## password

| Prop                    | Description                                               |
|-------------------------|-----------------------------------------------------------|
| `autoComplete`          | Sets the input `autoComplete` hint for password managers. |
| `minLength`             | Minimum allowed length (HTML constraint).                 |
| `maxLength`             | Maximum allowed length (HTML constraint).                 |
| `revealToggle`          | Show / hide the reveal toggle button.                     |
| `defaultRevealed`       | Initial revealed state (defaults to hidden).              |
| `onRevealChange`        | Called when revealed state changes.                       |
| `renderToggleIcon`      | Custom renderer for the toggle icon.                      |
| `toggleAriaLabel`       | ARIA label for the toggle button.                         |
| `toggleButtonClassName` | ClassName hook for the toggle button.                     |
| `strengthMeter`         | Enable the strength meter UI.                             |
| `ruleDefinitions`       | Custom rule definitions used by the strength meter.       |
| `ruleUses`              | Which rules should be considered when computing strength. |
| `meterStyle`            | Visual style of the strength meter.                       |
| `renderMeter`           | Custom renderer for the full meter block.                 |
| `meterWrapperClassName` | ClassName hook for the meter wrapper.                     |

> Password inherits the *visual* props from the `text` variant (it reuses the text UI), but controls `type`, value wiring, and trailing controls internally.

**Sample**

```tsx
<InputField
        variant="password"
        name="password"
        label="Password"
        required
        minLength={8}
        autoComplete="new-password"
        revealToggle
        strengthMeter
        ruleUses={["minLen", "upper", "lower", "number", "symbol"]}
/>
```

---

## phone

| Prop                   | Description                                                                     |
|------------------------|---------------------------------------------------------------------------------|
| `countries`            | List of allowed countries (and their dial codes) shown in the country selector. |
| `defaultCountryCode`   | The default selected country code (e.g. `"NG"`).                                |
| `allowCountrySearch`   | Enable searching in the country list.                                           |
| `allowCountryClear`    | Allow clearing the selected country.                                            |
| `countryPlaceholder`   | Placeholder text for the country selector.                                      |
| `showFlag`             | Show the flag in the country selector.                                          |
| `showCountryName`      | Show the country name in the selector / list.                                   |
| `showDialCode`         | Show dial codes in the country list.                                            |
| `showSelectedDialCode` | Show the selected dial code next to the input.                                  |
| `dialCodeDelimiter`    | Delimiter between dial code and the input number (e.g. `" "`, `"-"`).           |
| `valueMode`            | Controls how the field value is emitted (e.g. E.164 vs local formats).          |
| `mask`                 | Optional input mask (string or resolver function).                              |
| `lazy`                 | IMask â€œlazyâ€ mode (placeholder chars hidden until typed).                   |
| `keepCharPositions`    | IMask option to keep character positions stable.                                |
| `unmask`               | How the underlying mask value is emitted (IMask option).                        |

> Phone inherits the *visual* props from the `text` variant, but controls value parsing/formatting and the country selector internally.

**Sample**

```tsx
<InputField
        variant="phone"
        name="phone"
        label="Phone number"
        defaultCountryCode="NG"
        allowCountrySearch
        showSelectedDialCode
        dialCodeDelimiter=" "
        valueMode="e164"
/>
```

---

## Slider (`slider`)

Value type: `number | undefined`

### Props

| Prop                       | Description                                            |
|----------------------------|--------------------------------------------------------|
| `value`                    | Current slider value (number).                         |
| `onValue`                  | Called when the value changes.                         |
| `error`                    | Validation/error message for the field.                |
| `disabled`                 | Disables interaction.                                  |
| `readOnly`                 | Prevents changes but still displays the value.         |
| `size`                     | Sizing preset for the control.                         |
| `density`                  | Density preset for the control (spacing).              |
| `min`                      | Minimum value (default 0).                             |
| `max`                      | Maximum value (default 100).                           |
| `step`                     | Step size (default 1).                                 |
| `showValue`                | Show the current numeric value next to the slider.     |
| `valuePlacement`           | Where to render the value when `showValue` is enabled. |
| `formatValue`              | Format the displayed value.                            |
| `className`                | Root wrapper className.                                |
| `sliderClassName`          | Slider track/handle className.                         |
| `valueClassName`           | Value label className.                                 |
| `leadingIcons`             | Icons rendered before the slider/value.                |
| `trailingIcons`            | Icons rendered after the slider/value.                 |
| `icon`                     | Single icon (shorthand).                               |
| `iconGap`                  | Gap between icon(s) and content.                       |
| `leadingIconSpacing`       | Spacing between multiple leading icons.                |
| `trailingIconSpacing`      | Spacing between multiple trailing icons.               |
| `leadingControl`           | Optional control element rendered before the slider.   |
| `trailingControl`          | Optional control element rendered after the slider.    |
| `leadingControlClassName`  | Wrapper className for the leading control.             |
| `trailingControlClassName` | Wrapper className for the trailing control.            |
| `joinControls`             | Join controls visually to the slider box.              |
| `extendBoxToControls`      | Extend slider â€œboxâ€ background behind controls.    |
| `controlVariant`           | Variant for the +/- controls (if shown).               |
| `controlStep`              | Step used by +/- controls (falls back to `step`).      |
| `controlDecrementIcon`     | Custom icon node for decrement control.                |
| `controlIncrementIcon`     | Custom icon node for increment control.                |

### Example

```tsx
<InputField
        name="rating"
        label="Rating"
        variant="slider"
        min={0}
        max={100}
        step={5}
        showValue
        valuePlacement="right"
        formatValue={(v) => `${v}%`}
        controlVariant="ghost"
        controlStep={5}
/>
```

---

## Toggle (`toggle`)

Value type: `boolean | undefined`

### Props

| Prop                   | Description                                |
|------------------------|--------------------------------------------|
| `value`                | Current toggle value (boolean).            |
| `onValue`              | Called when the value changes.             |
| `error`                | Validation/error message for the field.    |
| `size`                 | Visual size of the switch.                 |
| `density`              | Spacing density for the wrapper.           |
| `onText`               | Text shown when the value is `true`.       |
| `offText`              | Text shown when the value is `false`.      |
| `label`                | Optional label rendered beside the switch. |
| `containerClassName`   | Wrapper className.                         |
| `switchRootClassName`  | ClassName for the Switch root element.     |
| `switchThumbClassName` | ClassName for the Switch thumb.            |

### Example

```tsx
<InputField
        name="enabled"
        label="Enabled"
        variant="toggle"
        onText="On"
        offText="Off"
        density="sm"
/>
```

---

## TreeSelect (`treeselect`)

Value type: `TreeKey | TreeKey[] | undefined` (where `TreeKey` is `string | number`)

### Base props

| Prop                    | Description                                                                    |
|-------------------------|--------------------------------------------------------------------------------|
| `value`                 | Selected key(s). Single value is a key; multi is an array of keys.             |
| `onValue`               | Called when selection changes.                                                 |
| `error`                 | Validation/error message for the field.                                        |
| `disabled`              | Disables interaction.                                                          |
| `readOnly`              | Prevents changes but still displays the selection.                             |
| `size`                  | Sizing preset for trigger/list rows.                                           |
| `density`               | Density preset for trigger/list rows.                                          |
| `options`               | Tree of options to render.                                                     |
| `multiple`              | Allow selecting multiple keys (returns `TreeKey[]`).                           |
| `autoCap`               | (Option mapping helper) Auto-capitalize generated labels when mapping options. |
| `optionLabel`           | (Option mapping helper) Label accessor (key name or function).                 |
| `optionValue`           | (Option mapping helper) Value accessor (key name or function).                 |
| `optionDescription`     | (Option mapping helper) Description accessor.                                  |
| `optionDisabled`        | (Option mapping helper) Disabled accessor.                                     |
| `optionIcon`            | (Option mapping helper) Icon accessor.                                         |
| `optionKey`             | (Option mapping helper) Key accessor.                                          |
| `searchable`            | Enable search input in the dropdown.                                           |
| `searchPlaceholder`     | Placeholder text for the search input.                                         |
| `emptyLabel`            | Content shown when there are no options.                                       |
| `emptySearchText`       | Content shown when search returns no matches.                                  |
| `clearable`             | Show a clear/reset action.                                                     |
| `placeholder`           | Text shown when nothing is selected.                                           |
| `className`             | Wrapper className for the whole field.                                         |
| `triggerClassName`      | ClassName for the trigger/button area.                                         |
| `contentClassName`      | ClassName for the dropdown content.                                            |
| `renderOption`          | Custom renderer for an option row.                                             |
| `renderValue`           | Custom renderer for the trigger's current value display.                       |
| `expandAll`             | Expand all nodes by default.                                                   |
| `defaultExpandedValues` | Keys that should start expanded by default.                                    |
| `leafOnly`              | Restrict selection to leaf nodes only.                                         |

### Mode: default (`mode` omitted or "default")

| Prop                       | Description                                                     |
|----------------------------|-----------------------------------------------------------------|
| `mode`                     | Omit or set to `'default'` to use the standard field trigger.   |
| `button`                   | Optional custom trigger button renderer.                        |
| `selectedBadge`            | Optional selected-count badge renderer.                         |
| `icon`                     | Single icon rendered near the trigger value.                    |
| `iconGap`                  | Gap between icon and content.                                   |
| `leadingIcons`             | One or more icons before the value.                             |
| `trailingIcons`            | One or more icons after the value.                              |
| `leadingControl`           | Custom control element before the trigger (e.g., clear button). |
| `trailingControl`          | Custom control element after the trigger.                       |
| `leadingControlClassName`  | ClassName for leading control wrapper.                          |
| `trailingControlClassName` | ClassName for trailing control wrapper.                         |
| `joinControls`             | Visually join controls to the trigger box (shared border).      |
| `extendBoxToControls`      | Extend trigger background behind controls.                      |
| `rootClassName`            | Wrapper className around controls + trigger.                    |
| `triggerInnerClassName`    | ClassName for the triggerâ€™s inner content.                    |

### Mode: button (`mode="button"`)

| Prop                       | Description                                                     |
|----------------------------|-----------------------------------------------------------------|
| `mode`                     | Set to `'button'` to render a button-style trigger.             |
| `button`                   | (mode='button') If provided, this is the trigger renderer.      |
| `selectedBadge`            | (mode='button') Selected-count badge renderer.                  |
| `icon`                     | Single icon rendered near the trigger value.                    |
| `iconGap`                  | Gap between icon and content.                                   |
| `leadingIcons`             | One or more icons before the value.                             |
| `trailingIcons`            | One or more icons after the value.                              |
| `leadingControl`           | Custom control element before the trigger (e.g., clear button). |
| `trailingControl`          | Custom control element after the trigger.                       |
| `leadingControlClassName`  | ClassName for leading control wrapper.                          |
| `trailingControlClassName` | ClassName for trailing control wrapper.                         |
| `joinControls`             | Visually join controls to the trigger box (shared border).      |
| `extendBoxToControls`      | Extend trigger background behind controls.                      |

### Example (default mode)

```tsx
<InputField
        name="category"
        label="Category"
        variant="treeselect"
        options={[
          {
            key: "social",
            label: "Social",
            children: [
              { key: "twitter", label: "Twitter" },
              { key: "instagram", label: "Instagram" },
            ],
          },
        ]}
        searchable
        placeholder="Pick oneâ€¦"
/>
```

### Example (multiple + button mode)

```tsx
<InputField
        name="tags"
        variant="treeselect"
        mode="button"
        multiple
        options={[
          { key: 1, label: "Starter" },
          { key: 2, label: "Pro" },
          { key: 3, label: "Enterprise" },
        ]}
/>
```

## multi-select

### Variant props

| Prop                | Description                                                                                                                     |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `options`           | Options for the multi-select. Accepts primitives or objects.                                                                    |
| `autoCap`           | Capitalise the first letter of the label (when the resolved label is a string).                                                 |
| `optionLabel`       | How to read the label from each option (string key or mapper function). If omitted: uses `label`, else `String(value)`.         |
| `optionValue`       | How to read the value from each option (string key or mapper function). If omitted: primitives are used directly, else `value`. |
| `optionDescription` | How to read the description from each option (string key or mapper function). If omitted: uses `description`.                   |
| `optionIcon`        | How to read the icon from each option (string key or mapper function). If omitted: uses `icon`.                                 |
| `optionDisabled`    | How to detect disabled options (string key or mapper function). If omitted: uses `disabled`.                                    |
| `optionKey`         | How to compute stable keys for items (string key or mapper function). If omitted: uses index.                                   |
| `searchable`        | Enable search field in the list.                                                                                                |
| `searchPlaceholder` | Placeholder for the search field.                                                                                               |
| `emptySearchText`   | Text when there are no matches for the current search.                                                                          |
| `showSelectAll`     | Show a â€œSelect allâ€ row.                                                                                                    |
| `selectAllLabel`    | Label for the â€œSelect allâ€ row.                                                                                             |
| `selectAllPosition` | Where to render the â€œSelect allâ€ row.                                                                                       |
| `clearable`         | Show a clear action when there is at least one selection.                                                                       |
| `placeholder`       | Placeholder when nothing is selected.                                                                                           |
| `renderOption`      | Optional global renderer for an option row. (An option may also provide its own per-option `render`.)                           |
| `renderCheckbox`    | Optional renderer for the checkbox element used by each option row.                                                             |
| `renderValue`       | Custom renderer for the trigger summary (selected values).                                                                      |
| `maxListHeight`     | Max height for the list (px).                                                                                                   |
| `className`         | Wrapper class for the whole variant.                                                                                            |
| `triggerClassName`  | Class for the trigger button.                                                                                                   |
| `contentClassName`  | Class for the popover content container.                                                                                        |

**Options can be passed as:**

* primitives: `['ng', 'gh', 'ke']`
* objects: `[{ label, value, ...extra }]`

### Mode and trigger props

| Prop                          | Description                                                                                          |
|-------------------------------|------------------------------------------------------------------------------------------------------|
| `mode`                        | Choose trigger style: `"default"` (standard input-like trigger) or `"button"` (custom trigger node). |
| `leadingIcons`                | Icons shown before the summary text inside the trigger (default mode).                               |
| `trailingIcons`               | Icons shown after the summary / clear button inside the trigger.                                     |
| `icon`                        | Single icon shorthand (falls into `leadingIcons`).                                                   |
| `iconGap`                     | Base gap (px) used between icon groups and text.                                                     |
| `leadingIconSpacing`          | Override spacing (px) between leading icons and text.                                                |
| `trailingIconSpacing`         | Override spacing (px) between trailing icons and the right-side controls.                            |
| `leadingControl`              | Custom node rendered on the far-left *outside* the trigger (e.g., a compact action button).          |
| `trailingControl`             | Custom node rendered on the far-right *outside* the trigger.                                         |
| `leadingControlClassName`     | ClassName for the leading control wrapper.                                                           |
| `trailingControlClassName`    | ClassName for the trailing control wrapper.                                                          |
| `joinControls`                | Visually joins leading/trailing controls with the trigger (no gaps).                                 |
| `extendBoxToControls`         | Extends the input box styling (border/background) around the joined controls.                        |
| `button`                      | Used when `mode="button"`. If provided, this is the trigger. If not provided, `children` is used.    |
| `children`                    | When `mode="button"` and `button` is not provided, `children` is used as the trigger content.        |
| `selectedBadge`               | Selected-count badge (mode="button" only).                                                           |
| `selectedBadgeHiddenWhenZero` | Hide the badge when selected count is 0 (mode="button").                                             |
| `selectedBadgeClassName`      | ClassName for the selected-count badge.                                                              |
| `selectedBadgePlacement`      | Where to place the badge relative to the trigger content (mode="button").                            |

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function MultiSelectExample() {
  return (
          <InputField
                  variant="multi-select"
                  name="countries"
                  label="Countries"
                  description="Pick one or more countries."
                  options={[
                    { label: "Nigeria", value: "ng" },
                    { label: "Ghana", value: "gh" },
                    { label: "Kenya", value: "ke" },
                  ]}
                  searchable
                  searchPlaceholder="Search countries..."
                  showSelectAll
                  selectAllLabel="Select all"
                  clearable
                  placeholder="Select countries..."
          />
  );
}
```

---

## radio

### Variant props

| Prop                   | Description                                                                                                           |
|------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `items`                | Alias of `options` (list of items to render).                                                                         |
| `options`              | Options to render. Supports `RadioItem` objects or custom items via mappers.                                          |
| `mappers`              | Mapping functions for `TItem â†’ value/label/description/disabled/key/render`. Takes precedence over `option*` props. |
| `optionValue`          | Shortcut mapping for **value** (used only if `mappers` is not provided).                                              |
| `optionLabel`          | Shortcut mapping for **label** (used only if `mappers` is not provided).                                              |
| `renderOption`         | Global option renderer (can be overridden per item via `item.render`).                                                |
| `layout`               | Layout mode: `"stack"` or `"grid"`.                                                                                   |
| `columns`              | Number of columns when `layout="grid"`.                                                                               |
| `itemGapPx`            | Gap (px) between items.                                                                                               |
| `size`                 | Variant size override for the radio control.                                                                          |
| `density`              | Variant density override for spacing.                                                                                 |
| `autoCap`              | Auto-capitalise labels when the resolved label is a string.                                                           |
| `aria-label`           | ARIA label forwarded to the radio group wrapper.                                                                      |
| `aria-labelledby`      | ARIA `aria-labelledby` forwarded to the radio group wrapper.                                                          |
| `aria-describedby`     | ARIA `aria-describedby` forwarded to the radio group wrapper.                                                         |
| `groupClassName`       | ClassName for the group wrapper.                                                                                      |
| `optionClassName`      | ClassName for each option container.                                                                                  |
| `labelClassName`       | ClassName for the option label.                                                                                       |
| `descriptionClassName` | ClassName for the option description.                                                                                 |
| `id`                   | Optional `id` for the group wrapper.                                                                                  |
| `name`                 | HTML `name` attribute to group radio inputs.                                                                          |
| `className`            | Alias for `groupClassName`.                                                                                           |

### Supported option shapes

* `RadioItem<TValue>`: `{ value, label, description?, disabled?, key?, render? }`
* Any `TItem` shape, as long as you provide `mappers` (or `optionLabel`/`optionValue` shortcuts)

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function RadioExample() {
  return (
          <InputField
                  variant="radio"
                  name="plan"
                  label="Plan"
                  description="Choose a plan."
                  items={[
                    { value: "free", label: "Free", description: "Basic features" },
                    { value: "pro", label: "Pro", description: "Everything included" },
                    { value: "team", label: "Team", description: "For small teams" },
                  ]}
                  layout="grid"
                  columns={3}
                  autoCap
          />
  );
}
```

---

## select

### Variant props

| Prop                       | Description                                                                                                                     |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `options`                  | Options for the select. Accepts primitives or objects.                                                                          |
| `autoCap`                  | Capitalise the first letter of the label (when the resolved label is a string).                                                 |
| `optionLabel`              | How to read the label from each option (string key or mapper function). If omitted: uses `label`, else `String(value)`.         |
| `optionValue`              | How to read the value from each option (string key or mapper function). If omitted: primitives are used directly, else `value`. |
| `optionDescription`        | How to read the description from each option (string key or mapper function). If omitted: uses `description`.                   |
| `optionIcon`               | How to read the icon from each option (string key or mapper function). If omitted: uses `icon`.                                 |
| `optionDisabled`           | How to detect disabled options (string key or mapper function). If omitted: uses `disabled`.                                    |
| `optionKey`                | How to compute stable keys for items (string key or mapper function). If omitted: uses index.                                   |
| `searchable`               | Enable search field in the list.                                                                                                |
| `searchPlaceholder`        | Placeholder for the search field.                                                                                               |
| `emptySearchText`          | Text shown when there are no matches for the current search.                                                                    |
| `clearable`                | Show a clear action (x) when a value is selected.                                                                               |
| `emptyLabel`               | Label to show when no value is selected (acts like â€œnoneâ€).                                                                 |
| `placeholder`              | Placeholder when no value is selected (and `emptyLabel` not shown).                                                             |
| `renderOption`             | Optional global renderer for a list option. (An option may also provide its own per-option `render`.)                           |
| `renderValue`              | Custom renderer for the trigger display (selected option).                                                                      |
| `virtualScroll`            | Enable virtual scrolling for large option lists.                                                                                |
| `virtualScrollThreshold`   | Number of items after which virtual scroll is enabled (when `virtualScroll=true`).                                              |
| `virtualScrollPageSize`    | How many items to render per virtual page/chunk.                                                                                |
| `leadingControl`           | Custom node rendered on the far-left *outside* the trigger.                                                                     |
| `leadingControlClassName`  | ClassName for the leading control wrapper.                                                                                      |
| `leadingIconSpacing`       | Override spacing (px) between leading icons and the selected value.                                                             |
| `trailingIcons`            | Icons shown on the right side of the trigger.                                                                                   |
| `trailingControl`          | Custom node rendered on the far-right *outside* the trigger.                                                                    |
| `trailingControlClassName` | ClassName for the trailing control wrapper.                                                                                     |
| `trailingIconSpacing`      | Override spacing (px) between selected value and trailing icons.                                                                |
| `joinControls`             | Visually joins leading/trailing controls with the trigger (no gaps).                                                            |
| `extendBoxToControls`      | Extends the input box styling (border/background) around the joined controls.                                                   |
| `icon`                     | Single icon shorthand (used in default mode).                                                                                   |
| `iconGap`                  | Base gap (px) used between icon and text.                                                                                       |
| `className`                | Wrapper class for the whole variant.                                                                                            |
| `triggerClassName`         | Class for the trigger button.                                                                                                   |
| `contentClassName`         | Class for the popover content container.                                                                                        |
| `mode`                     | Choose trigger style: `"default"` (normal select trigger) or `"button"` (custom trigger node).                                  |
| `leadingIcons`             | Icons shown before the selected value inside the trigger (default mode).                                                        |
| `button`                   | Used when `mode="button"`. If provided, this is the trigger. If not provided, `children` is used.                               |
| `children`                 | When `mode="button"` and `button` is not provided, `children` is used as the trigger content.                                   |

**Options can be passed as:**

* primitives: `['ng', 'gh', 'ke']`
* objects: `[{ label, value, ...extra }]`

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function SelectExample() {
  return (
          <InputField
                  variant="select"
                  name="country"
                  label="Country"
                  options={[
                    { label: "Nigeria", value: "ng", description: "NG" },
                    { label: "Ghana", value: "gh", description: "GH" },
                    { label: "Kenya", value: "ke", description: "KE" },
                  ]}
                  searchable
                  searchPlaceholder="Search..."
                  clearable
                  emptyLabel="No selection"
                  placeholder="Select a country..."
                  virtualScroll
                  virtualScrollThreshold={80}
                  virtualScrollPageSize={30}
          />
  );
}
```

## checkbox

| Prop                   | Description                                                                                                                        |                                |                        |
|------------------------|------------------------------------------------------------------------------------------------------------------------------------|--------------------------------|------------------------|
| `single`               | Render a single boolean checkbox instead of an option group.                                                                       |                                |                        |
| `singleLabel`          | Label text shown next to the checkbox in single mode.                                                                              |                                |                        |
| `singleDescription`    | Optional helper text shown under the single checkbox label.                                                                        |                                |                        |
| `options`              | Option list for group mode. Accepts primitives or objects (normalized to `{ value, label, description?, disabled?, key? }`).       |                                |                        |
| `items`                | Alias for `options` (alternate naming).                                                                                            |                                |                        |
| `mappers`              | Override normalization: `{ mapValue?, mapLabel?, mapDescription?, mapDisabled?, mapKey? }`.                                        |                                |                        |
| `optionValue`          | Map item â†’ option value (overrides `mappers.mapValue`).                                                                          |                                |                        |
| `optionLabel`          | Map item â†’ option label (overrides `mappers.mapLabel`).                                                                          |                                |                        |
| `optionDescription`    | Map item â†’ option description (overrides `mappers.mapDescription`).                                                              |                                |                        |
| `optionDisabled`       | Map item â†’ disabled boolean (overrides `mappers.mapDisabled`).                                                                   |                                |                        |
| `optionKey`            | Map item â†’ stable React key (overrides `mappers.mapKey`).                                                                        |                                |                        |
| `renderOption`         | Custom option renderer (gets `{ item, index, state, effectiveTristate, disabled, size, density, checkboxId, click(), checkbox }`). |                                |                        |
| `tristate`             | Enable tri-state cycling for group options (`none â†’ true â†’ false â†’ none`).                                                   |                                |                        |
| `layout`               | Group layout: `"list"` or `"grid"`.                                                                                                |                                |                        |
| `columns`              | Grid columns when `layout="grid"` (default: `2`).                                                                                  |                                |                        |
| `itemGapPx`            | Gap between options in px (defaults vary by layout).                                                                               |                                |                        |
| `size`                 | Checkbox size: `"sm"                                                                                                               | "md"                           | "lg"`(default:`"md"`). |
| `density`              | Spacing preset: `"compact"                                                                                                         | "normal"`(default:`"normal"`). |                        |
| `autoCap`              | Auto-capitalize option labels.                                                                                                     |                                |                        |
| `groupClassName`       | Class applied to the options wrapper.                                                                                              |                                |                        |
| `className`            | Alias for `groupClassName`.                                                                                                        |                                |                        |
| `optionClassName`      | Class applied to each option container.                                                                                            |                                |                        |
| `labelClassName`       | Class applied to label text (single + option labels).                                                                              |                                |                        |
| `optionLabelClassName` | Extra class applied to each option label.                                                                                          |                                |                        |
| `descriptionClassName` | Extra class applied to option descriptions.                                                                                        |                                |                        |
| `id`                   | Wrapper id.                                                                                                                        |                                |                        |
| `name`                 | Base `name` used for hidden inputs in group mode.                                                                                  |                                |                        |
| `aria-label`           | Accessibility label for the group wrapper.                                                                                         |                                |                        |
| `aria-labelledby`      | Id of an element that labels the group wrapper.                                                                                    |                                |                        |
| `aria-describedby`     | Id of an element that describes the group wrapper.                                                                                 |                                |                        |

**Value shape notes**

* **Single mode:** `boolean | undefined`
* **Group mode:** `CheckboxGroupEntry[] | undefined`, where each entry is `{ value, state }`.

    * `"none"` is an internal state only (it never appears in the public value).

**Sample usage**

```tsx
// single (boolean)
<InputField
        name="agree_tos"
        label="Terms"
        variant="checkbox"
        single
        singleLabel="I agree to the Terms of Service"
/>

// group (with tri-state)
<InputField
        name="notify_prefs"
        label="Notify me"
        variant="checkbox"
        tristate
        layout="grid"
        columns={2}
        options={[
          { label: "Email", value: "email", description: "Marketing + account alerts" },
          { label: "SMS", value: "sms" },
          { label: "Push", value: "push" },
        ]}
/>
```

## chips

| Prop                   | Description                                                              |                               |
|------------------------|--------------------------------------------------------------------------|-------------------------------|
| `placeholder`          | Placeholder shown when there are no chips and input is empty.            |                               |
| `separators`           | Separators used to split raw input into chips. Default: `[",", ";"]`.    |                               |
| `addOnEnter`           | Commit chips on **Enter**. Default: `true`.                              |                               |
| `addOnTab`             | Commit chips on **Tab**. Default: `true`.                                |                               |
| `addOnBlur`            | Commit chips on **blur**. Default: `true`.                               |                               |
| `allowDuplicates`      | When `false`, duplicate chips are ignored. Default: `false`.             |                               |
| `maxChips`             | Maximum number of chips allowed (`undefined` â†’ unlimited).             |                               |
| `backspaceRemovesLast` | Remove last chip on Backspace when input is empty. Default: `true`.      |                               |
| `clearable`            | Show a clear-all button. Default: `false`.                               |                               |
| `onAddChips`           | Callback: `(added, next) => void` after chips are added.                 |                               |
| `onRemoveChips`        | Callback: `(removed, next) => void` after chips are removed.             |                               |
| `renderChip`           | Custom chip renderer. You handle remove UI by calling `onRemove(index)`. |                               |
| `renderOverflowChip`   | Custom renderer for the overflow chip (when some chips are hidden).      |                               |
| `maxVisibleChips`      | Maximum number of chips visible before showing an overflow chip.         |                               |
| `maxChipChars`         | Soft cap for chip display label length (UI-only).                        |                               |
| `maxChipWidth`         | Soft cap for chip width (UI-only).                                       |                               |
| `textareaMode`         | Use textarea input instead of single-line input. Default: `false`.       |                               |
| `placement`            | Chips placement: `"inline"                                               | "below"`(default:`"inline"`). |
| `className`            | Class applied to the main wrapper.                                       |                               |
| `chipsClassName`       | Class applied to the chips container.                                    |                               |
| `chipClassName`        | Class applied to each chip wrapper.                                      |                               |
| `chipLabelClassName`   | Class applied to each chip label text.                                   |                               |
| `chipRemoveClassName`  | Class applied to each chip remove button.                                |                               |
| `inputClassName`       | Class applied to the input/textarea element.                             |                               |

> **Also supports** most `ShadcnTextVariantProps` (size, density, icons, etc.).

**Sample usage**

```tsx
<InputField
        name="tags"
        label="Tags"
        variant="chips"
        placeholder="Add tagsâ€¦"
        separators={[",", ";"]}
        maxChips={10}
        clearable
/>

<InputField
        name="emails"
        label="Allowed emails"
        variant="chips"
        textareaMode
        placement="below"
        addOnEnter
        addOnBlur
/>
```

## color

| Prop                     | Description                                                                |
|--------------------------|----------------------------------------------------------------------------|
| `showPreview`            | Show a color preview button / swatch. Default: `true`.                     |
| `showPickerToggle`       | Show the small picker toggle icon. Default: `true`.                        |
| `previewSize`            | Preview swatch size in px. Default: `16`.                                  |
| `wrapperClassName`       | Class applied to the wrapper.                                              |
| `previewButtonClassName` | Class applied to the preview button.                                       |
| `previewSwatchClassName` | Class applied to the swatch element inside the preview.                    |
| `pickerInputClassName`   | Class applied to the picker input wrapper.                                 |
| `pickerToggleIcon`       | Icon component for the toggle (a `React.ElementType`). Default: `Palette`. |

> **Also supports** `ShadcnTextVariantProps`, minus: `type`, `inputMode`, `autoComplete`, `autoCap`, `leadingIcon`, `trailingIcon`, `invalid`, `mono`.

**Sample usage**

```tsx
import { Palette } from "lucide-react";

<InputField
        name="brand_color"
        label="Brand color"
        variant="color"
        placeholder="#1d4ed8"
        showPreview
        previewSize={18}
        showPickerToggle
        pickerToggleIcon={Palette}
/>
```

## date

### Variant props

| Prop               | Description                                                                                                                                                |                                           |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------|
| `mode`             | Selection mode: `"single"` or `"range"`.                                                                                                                   |                                           |
| `placeholder`      | Placeholder content shown when thereâ€™s no selection.                                                                                                     |                                           |
| `clearable`        | If `true`, shows a clear action when a value is set.                                                                                                       |                                           |
| `minDate`          | Minimum selectable date (inclusive).                                                                                                                       |                                           |
| `maxDate`          | Maximum selectable date (inclusive).                                                                                                                       |                                           |
| `disabledDays`     | Disabled-day matcher forwarded to the calendar wrapper (`Calendar["disabled"]`).                                                                           |                                           |
| `formatSingle`     | Display pattern for single values. Supports tokens: `yyyy`, `MM`, `dd`, `HH`, `mm`. Defaults depend on `kind`.                                             |                                           |
| `formatRange`      | Range display formatter: either a pattern string (same tokens as `formatSingle`) or a custom `(range) => string` formatter.                                |                                           |
| `rangeSeparator`   | Separator used between `from` and `to` when `formatRange` is a string pattern. Default: `" â€“ "`.                                                         |                                           |
| `stayOpenOnSelect` | If `true`, keeps the popover open after selecting. In range mode, stays open until both ends are chosen.                                                   |                                           |
| `open`             | Controlled open state for the popover.                                                                                                                     |                                           |
| `onOpenChange`     | Called when the popover open state changes.                                                                                                                |                                           |
| `kind`             | Temporal kind that drives default mask + parsing/formatting (e.g. `"date"`, `"datetime"`, `"time"`, `"hour"`, `"monthYear"`, `"year"`). Default: `"date"`. |                                           |
| `inputMask`        | Optional explicit mask pattern for the input (`9` = digit, `a` = letter, `*` = alphanumeric). If omitted, a default based on `kind` is used.               |                                           |
| `showCalendar`     | Whether to render the calendar popover. Defaults: `true` for `kind="date"                                                                                  | "datetime"`, `false` for time-only kinds. |

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function DateRangeExample() {
  return (
          <InputField
                  variant="date"
                  name="period"
                  label="Billing period"
                  description="Select a date range."
                  mode="range"
                  kind="date"
                  placeholder="YYYY-MM-DD â€“ YYYY-MM-DD"
                  clearable
                  minDate={new Date(2025, 0, 1)}
                  maxDate={new Date(2025, 11, 31)}
                  // defaultValue can be a Date or { from?: Date; to?: Date }
                  defaultValue={{ from: new Date(2025, 0, 1), to: new Date(2025, 0, 31) }}
          />
  );
}
```

---

## keyvalue

### Variant props

| Prop             | Description                                                                                                      |
|------------------|------------------------------------------------------------------------------------------------------------------|
| `min`            | Minimum number of pairs allowed (enforced by the UI controls).                                                   |
| `max`            | Maximum number of pairs allowed.                                                                                 |
| `minVisible`     | Minimum number of chips to show before collapsing into a â€œmoreâ€ indicator.                                   |
| `maxVisible`     | Maximum number of chips to show before collapsing into a â€œmoreâ€ indicator.                                   |
| `showAddButton`  | Toggle visibility of the â€œAddâ€ action.                                                                       |
| `showMenuButton` | Toggle visibility of the overflow/menu action (if supported by the preset).                                      |
| `placeholder`    | Placeholder shown when there are no items.                                                                       |
| `dialogTitle`    | Title for the edit/add dialog UI.                                                                                |
| `keyLabel`       | Label used for the â€œkeyâ€ input.                                                                              |
| `valueLabel`     | Label used for the â€œvalueâ€ input.                                                                            |
| `submitLabel`    | Text for the dialog submit button.                                                                               |
| `moreLabel`      | Label renderer for the collapsed â€œmoreâ€ indicator: `(count) => ReactNode`.                                   |
| `emptyLabel`     | Label shown when there are no entries (fallback text).                                                           |
| `className`      | Wrapper class for the whole variant.                                                                             |
| `chipsClassName` | Class for the chips container.                                                                                   |
| `chipClassName`  | Class for each chip.                                                                                             |
| `renderChip`     | Custom chip renderer. Receives `{ pair, index, onEdit, onRemove, defaultChip }` and should return a `ReactNode`. |

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function KeyValueExample() {
  return (
          <InputField
                  variant="keyvalue"
                  name="headers"
                  label="Headers"
                  description="Key-value headers to include in requests."
                  placeholder="No headers"
                  dialogTitle="Edit headers"
                  keyLabel="Header"
                  valueLabel="Value"
                  submitLabel="Save"
                  moreLabel={(count) => `+${count} more`}
                  min={0}
                  max={20}
                  defaultValue={{ "X-Client": "timeax", "X-Mode": "dev" }}
          />
  );
}
```

---

## editor

### Variant props

| Prop               | Description                                                       |
|--------------------|-------------------------------------------------------------------|
| `placeholder`      | Placeholder content when the editor is empty.                     |
| `minHeight`        | Minimum height (px) for the editor surface.                       |
| `maxHeight`        | Maximum height (px) for the editor surface (scrolls beyond this). |
| `rows`             | Row hint for initial sizing (when using a textarea-like layout).  |
| `toolbar`          | Toolbar preset/variant (e.g. `"minimal"`, `"default"`, `"full"`). |
| `allowLinks`       | Whether links are allowed/enabled.                                |
| `allowImages`      | Whether images are allowed/enabled.                               |
| `allowTables`      | Whether tables are allowed/enabled.                               |
| `allowLists`       | Whether lists are allowed/enabled.                                |
| `allowCode`        | Whether code blocks/inline code are allowed/enabled.              |
| `sanitizeHtml`     | If `true`, sanitizes HTML before emitting/storing it.             |
| `className`        | Wrapper class for the whole variant.                              |
| `editorClassName`  | Class for the editor surface.                                     |
| `toolbarClassName` | Class for the toolbar wrapper.                                    |

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function EditorExample() {
  return (
          <InputField
                  variant="editor"
                  name="bio"
                  label="Bio"
                  description="Write a short bio."
                  placeholder="Start typing..."
                  rows={8}
                  minHeight={160}
                  maxHeight={420}
                  toolbar="default"
                  allowLinks
                  allowLists
                  sanitizeHtml
          />
  );
}
```

## file

### Variant props

| Prop                | Description                                                              |
|---------------------|--------------------------------------------------------------------------|
| `multiple`          | Allow selecting multiple files.                                          |
| `accept`            | Accepted file types (input accept string / list).                        |
| `maxFiles`          | Max number of files allowed.                                             |
| `maxTotalSize`      | Max total size allowed for all files (bytes).                            |
| `showDropArea`      | Show the drop-area UI section.                                           |
| `dropIcon`          | Optional icon shown in the drop area.                                    |
| `dropTitle`         | Title text shown in the drop area.                                       |
| `dropDescription`   | Helper text shown in the drop area.                                      |
| `custom`            | Use a fully custom â€œpickerâ€ UI instead of the built-in drop/trigger. |
| `asRaw`             | Treat values as raw `File` objects (native picker flow).                 |
| `renderDropArea`    | Custom renderer for the drop area section.                               |
| `renderFileItem`    | Custom renderer for each file item row.                                  |
| `showCheckboxes`    | Show checkboxes next to file items (when supported by the UI).           |
| `onFilesAdded`      | Callback fired when files are added.                                     |
| `customLoader`      | Provide your own file loader (e.g. resolve URLs â†’ metadata).           |
| `mergeMode`         | Merge strategy when adding files (e.g. append/replace/dedupe).           |
| `formatFileName`    | Custom formatter for displaying a file name.                             |
| `formatFileSize`    | Custom formatter for displaying a file size.                             |
| `placeholder`       | Placeholder text when nothing is selected.                               |
| `className`         | Wrapper class for the whole variant.                                     |
| `dropAreaClassName` | ClassName for the drop-area wrapper.                                     |
| `listClassName`     | ClassName for the file list container.                                   |
| `triggerClassName`  | ClassName for the trigger (when using the built-in trigger).             |

### Mode and trigger props

| Prop                          | Description                                                             |
|-------------------------------|-------------------------------------------------------------------------|
| `mode`                        | Trigger style: `"default"` (input-like) or `"button"` (custom trigger). |
| `leadingIcons`                | Icons shown before the summary (default mode).                          |
| `trailingIcons`               | Icons shown after the summary / clear action.                           |
| `icon`                        | Single icon shorthand (falls into leading icons).                       |
| `iconGap`                     | Base gap (px) between icon groups and text.                             |
| `leadingIconSpacing`          | Override spacing (px) between leading icons and text.                   |
| `trailingIconSpacing`         | Override spacing (px) between summary and trailing controls.            |
| `leadingControl`              | Custom node on the far-left *outside* the trigger.                      |
| `trailingControl`             | Custom node on the far-right *outside* the trigger.                     |
| `leadingControlClassName`     | ClassName for the leading control wrapper.                              |
| `trailingControlClassName`    | ClassName for the trailing control wrapper.                             |
| `joinControls`                | Visually â€œjoinsâ€ leading/trailing controls with the trigger.        |
| `extendBoxToControls`         | Extends the input box styling around joined controls.                   |
| `button`                      | When `mode="button"`: explicit trigger node.                            |
| `children`                    | When `mode="button"` and `button` is not provided: trigger content.     |
| `selectedBadge`               | Selected-count badge (button mode).                                     |
| `selectedBadgeHiddenWhenZero` | Hide badge when selected count is 0.                                    |
| `selectedBadgeClassName`      | ClassName for the selected-count badge.                                 |
| `selectedBadgePlacement`      | Where to place the badge relative to the trigger content.               |

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function FileExample() {
  return (
          <InputField
                  variant="file"
                  name="attachments"
                  label="Attachments"
                  description="Upload up to 3 files (max 10MB total)."
                  multiple
                  accept={["image/*", "application/pdf"]}
                  maxFiles={3}
                  maxTotalSize={10 * 1024 * 1024}
                  showDropArea
                  placeholder="Choose files..."
          />
  );
}
```

---

## icon

### Variant props

| Prop               | Description                                                        |
|--------------------|--------------------------------------------------------------------|
| `multiple`         | Allow selecting multiple icons (value becomes `string[]`).         |
| `url`              | Iconify API base URL (defaults to registry `iconPicker.url`).      |
| `groups`           | Icon groups to display (defaults to registry `iconPicker.groups`). |
| `allowedGroupIds`  | Restrict selectable groups by group id.                            |
| `maxRender`        | Max icons rendered in the grid (safety cap for large sets).        |
| `placeholder`      | Placeholder text when nothing is selected.                         |
| `className`        | Wrapper class for the whole variant.                               |
| `triggerClassName` | ClassName for the trigger (default mode).                          |
| `popoverClassName` | ClassName for the popover content wrapper.                         |

### Mode and trigger props

| Prop                          | Description                                                             |
|-------------------------------|-------------------------------------------------------------------------|
| `mode`                        | Trigger style: `"default"` (input-like) or `"button"` (custom trigger). |
| `leadingIcons`                | Icons shown before the selection (default mode).                        |
| `trailingIcons`               | Icons shown after the selection.                                        |
| `icon`                        | Single icon shorthand (falls into leading icons).                       |
| `leadingControl`              | Custom node on the far-left *outside* the trigger.                      |
| `trailingControl`             | Custom node on the far-right *outside* the trigger.                     |
| `leadingControlClassName`     | ClassName for the leading control wrapper.                              |
| `trailingControlClassName`    | ClassName for the trailing control wrapper.                             |
| `joinControls`                | Visually "joins" leading/trailing controls with the trigger.            |
| `extendBoxToControls`         | Extends the input box styling around joined controls.                   |
| `button`                      | When `mode="button"`: explicit trigger node.                            |
| `children`                    | When `mode="button"` and `button` is not provided: trigger content.     |
| `selectedBadge`               | Selected-count badge (button mode).                                     |
| `selectedBadgeHiddenWhenZero` | Hide badge when selected count is 0.                                    |
| `selectedBadgeVariant`        | Badge style variant (button mode).                                      |
| `selectedBadgeClassName`      | ClassName for the selected-count badge.                                 |
| `selectedBadgePlacement`      | Where to place the badge relative to trigger content.                   |

> Note: In `mode="button"`, the icon/control props (`leadingIcons`, `trailingIcons`, `leadingControl`, etc.) are not supported.
>
> Value is an Iconify name string (e.g. `"mdi:home"`) or `string[]` when `multiple` is true.

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette";

export function IconExample() {
  return (
          <InputField
                  variant="icon"
                  name="app_icon"
                  label="App icon"
                  placeholder="Search icons..."
          />
  );
}
```

---

## image-icon

### Variant props

| Prop                  | Description                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| `multiple`            | Allow selecting multiple items (icons and/or images).                                                         |
| `iconUrl`             | Iconify API base URL for the icon picker (defaults to registry `iconPicker.url`).                             |
| `iconGroups`          | Icon groups to display (defaults to registry `iconPicker.groups`).                                            |
| `allowedIconGroupIds` | Restrict selectable icon groups by id.                                                                        |
| `iconMaxRender`       | Max icons rendered in the grid (safety cap for large sets).                                                   |
| `accept`              | Accepted file types (input accept string / list).                                                             |
| `maxFiles`            | Max number of files allowed.                                                                                  |
| `maxTotalSize`        | Max total size allowed for all files (bytes).                                                                 |
| `customLoader`        | Provide your own file loader or pass true to use your global built-in loader (e.g. resolve URLs -> metadata). |
| `mergeMode`           | Merge strategy when adding files (`"append"` or `"replace"`).                                                 |
| `formatFileName`      | Custom formatter for displaying a file name.                                                                  |
| `formatFileSize`      | Custom formatter for displaying a file size.                                                                  |
| `formatFileValue`     | Convert a `FileItem` into a persisted string value (falls back to `url`, `path`, or native file).             |
| `placeholder`         | Placeholder text when nothing is selected.                                                                    |
| `className`           | Wrapper class for the whole variant.                                                                          |
| `triggerClassName`    | ClassName for the trigger (default mode).                                                                     |
| `popoverClassName`    | ClassName for the popover content wrapper.                                                                    |
| `showCheckboxes`      | Show checkboxes next to items in the list (when supported by the UI).                                         |

### Mode and trigger props

| Prop                          | Description                                                             |
|-------------------------------|-------------------------------------------------------------------------|
| `mode`                        | Trigger style: `"default"` (input-like) or `"button"` (custom trigger). |
| `leadingIcons`                | Icons shown before the summary (default mode).                          |
| `trailingIcons`               | Icons shown after the summary / clear action.                           |
| `icon`                        | Single icon shorthand (falls into leading icons).                       |
| `leadingControl`              | Custom node on the far-left *outside* the trigger.                      |
| `trailingControl`             | Custom node on the far-right *outside* the trigger.                     |
| `leadingControlClassName`     | ClassName for the leading control wrapper.                              |
| `trailingControlClassName`    | ClassName for the trailing control wrapper.                             |
| `joinControls`                | Visually "joins" leading/trailing controls with the trigger.            |
| `extendBoxToControls`         | Extends the input box styling around joined controls.                   |
| `button`                      | When `mode="button"`: explicit trigger node.                            |
| `children`                    | When `mode="button"` and `button` is not provided: trigger content.     |
| `selectedBadge`               | Selected-count badge (button mode).                                     |
| `selectedBadgeHiddenWhenZero` | Hide badge when selected count is 0.                                    |
| `selectedBadgeVariant`        | Badge style variant (button mode).                                      |
| `selectedBadgeClassName`      | ClassName for the selected-count badge.                                 |
| `selectedBadgePlacement`      | Where to place the badge relative to trigger content.                   |

> Note: In `mode="button"`, the icon/control props (`leadingIcons`, `trailingIcons`, `leadingControl`, etc.) are not supported.
>
> Value accepts `string` or `File` (or arrays). Strings can be Iconify names (e.g. `"lucide:camera"`) or image/file URLs/paths.

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette";

export function ImageIconExample() {
  return (
          <InputField
                  variant="image-icon"
                  name="avatar"
                  label="Avatar"
                  placeholder="Pick an image or icon..."
                  accept={["image/*", ".svg"]}
                  iconGroups={[
                    { id: "brand", label: "Brand", prefixes: ["simple-icons"] },
                  ]}
          />
  );
}
```

---

## json-editor

### Wrapper / trigger props

| Prop               | Description                                               |
|--------------------|-----------------------------------------------------------|
| `mode`             | Display mode: `"popover"` or `"accordion"`.               |
| `trigger`          | Custom trigger node (popover mode).                       |
| `triggerLabel`     | Default trigger label text (popover mode).                |
| `triggerVariant`   | Visual variant for the trigger button.                    |
| `triggerSize`      | Size for the trigger button.                              |
| `openLabel`        | Label text when opening the popover.                      |
| `closeLabel`       | Label text when closing the popover.                      |
| `open`             | Controlled open state (popover mode).                     |
| `onOpenChange`     | Open-state change callback.                               |
| `onClose`          | Callback fired when the popover closes.                   |
| `id`               | Optional id for accessibility wiring.                     |
| `describedBy`      | Optional `aria-describedby` target id.                    |
| `wrapperClassName` | ClassName for the outer wrapper.                          |
| `popoverClassName` | ClassName for the popover content wrapper (popover mode). |
| `panelClassName`   | ClassName for the editor panel wrapper.                   |

### Editor props (passed into the JSON editor)

| Prop               | Description                                                                           |
|--------------------|---------------------------------------------------------------------------------------|
| `title`            | Title displayed in the editor header.                                                 |
| `fieldMap`         | Field mapping rules (wildcards supported) â†’ picks a field variant + props per path. |
| `layout`           | Layout rules (grid/rows + route/page rules).                                          |
| `defaults`         | Default values / behaviours for missing keys and created fields.                      |
| `filters`          | Include/exclude filters for routes/fields.                                            |
| `permissions`      | Permissions (add/delete/view/edit raw, etc.).                                         |
| `callbacks`        | Hooks for events like add/delete/edit / route changes.                                |
| `route`            | Controlled â€œpage routeâ€ (e.g. `"config.headers"`).                                |
| `defaultRoute`     | Starting route when uncontrolled.                                                     |
| `onRouteChange`    | Route change callback.                                                                |
| `viewMode`         | Controlled view mode (e.g. raw vs structured UI).                                     |
| `defaultViewMode`  | Default view mode when uncontrolled.                                                  |
| `onViewModeChange` | View mode change callback.                                                            |
| `className`        | Root class for the editor.                                                            |
| `contentClassName` | Class for the main content region.                                                    |
| `navClassName`     | Class for the navigation region.                                                      |
| `bodyClassName`    | Class for the body region.                                                            |

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function JsonEditorExample() {
  return (
          <InputField
                  variant="json-editor"
                  name="settings"
                  label="Settings"
                  description="Edit advanced settings as a structured UI."
                  mode="popover"
                  triggerLabel="Edit settings"
                  title="Settings"
                  defaultValue={{
                    projectName: "",
                    config: { apiUrl: "", enabled: true },
                  }}
                  fieldMap={{
                    projectName: { variant: "text", props: { label: "Project name" } },
                    "config.apiUrl": { variant: "text", props: { label: "API URL" } },
                    "config.enabled": { variant: "toggle", props: { label: "Enabled" } },
                    "**.*token*": { variant: "password", props: { label: "Token" } },
                  }}
                  permissions={{
                    canViewRaw: true,
                    canEditRaw: false,
                    canAdd: true,
                    canDelete: true,
                  }}
          />
  );
}
```

---

## lister

### Data + mapping props

| Prop                | Description                                                             |
|---------------------|-------------------------------------------------------------------------|
| `def`               | Base lister definition (columns, source, mapping, etc.).                |
| `endpoint`          | Inline source endpoint (standalone inline mode).                        |
| `method`            | Inline HTTP method: `"GET"` or `"POST"`.                                |
| `buildRequest`      | Custom request builder (params/body/headers).                           |
| `selector`          | How to extract the array from the response (function or selector path). |
| `optionValue`       | How to map a raw row â†’ option value (key or function).                |
| `optionLabel`       | How to map a raw row â†’ label.                                         |
| `optionIcon`        | How to map a raw row â†’ icon.                                          |
| `optionDescription` | How to map a raw row â†’ description.                                   |
| `optionDisabled`    | How to map a raw row â†’ disabled.                                      |
| `optionGroup`       | How to map a raw row â†’ group label.                                   |
| `optionMeta`        | How to map a raw row â†’ meta payload.                                  |
| `search`            | Search override (inline).                                               |
| `searchTarget`      | Search target override (inline).                                        |

### Selection + behaviour props

| Prop               | Description                                                |
|--------------------|------------------------------------------------------------|
| `filters`          | Filters payload used by the lister source.                 |
| `confirm`          | Optional confirm behaviour (e.g. confirm selection).       |
| `permissions`      | Permissions object used by the lister UI (actions, views). |
| `placeholder`      | Placeholder text when nothing is selected.                 |
| `maxDisplayItems`  | Max chips/labels to show before collapsing into â€œ+Nâ€.  |
| `renderTrigger`    | Custom trigger renderer.                                   |
| `title`            | Title displayed when opening the lister UI.                |
| `searchMode`       | Search mode for the open UI.                               |
| `initialQuery`     | Initial query state.                                       |
| `showRefresh`      | Show refresh button.                                       |
| `refreshMode`      | Refresh behaviour/mode.                                    |
| `filtersSpec`      | Filters spec for the open UI.                              |
| `renderOption`     | Custom renderer for option rows.                           |
| `host`             | Override lister host implementation.                       |
| `presets`          | Override preset map used by lister internals.              |
| `remoteDebounceMs` | Debounce (ms) for remote search requests.                  |

### Trigger styling + container props

| Prop                          | Description                                                             |
|-------------------------------|-------------------------------------------------------------------------|
| `mode`                        | Trigger style: `"default"` (input-like) or `"button"` (custom trigger). |
| `clearable`                   | Show clear action when a selection exists.                              |
| `leadingIcons`                | Icons shown before the summary (default mode).                          |
| `trailingIcons`               | Icons shown after the summary / clear action.                           |
| `icon`                        | Single icon shorthand.                                                  |
| `iconGap`                     | Base gap (px) between icon groups and text.                             |
| `leadingIconSpacing`          | Override spacing (px) between leading icons and text.                   |
| `trailingIconSpacing`         | Override spacing (px) between summary and trailing controls.            |
| `leadingControl`              | Custom node on the far-left *outside* the trigger.                      |
| `trailingControl`             | Custom node on the far-right *outside* the trigger.                     |
| `leadingControlClassName`     | ClassName for the leading control wrapper.                              |
| `trailingControlClassName`    | ClassName for the trailing control wrapper.                             |
| `joinControls`                | Visually â€œjoinsâ€ leading/trailing controls with the trigger.        |
| `extendBoxToControls`         | Extends the input box styling around joined controls.                   |
| `maxListHeight`               | Max height for the open list/panel (px).                                |
| `className`                   | Wrapper class for the whole variant.                                    |
| `triggerClassName`            | ClassName for the trigger.                                              |
| `contentClassName`            | ClassName for the popover/content container.                            |
| `panelClassName`              | ClassName for the panel surface wrapper.                                |
| `button`                      | When `mode="button"`: explicit trigger node.                            |
| `children`                    | When `mode="button"` and `button` is not provided: trigger content.     |
| `selectedBadge`               | Selected-count badge (button mode).                                     |
| `selectedBadgeHiddenWhenZero` | Hide badge when selected count is 0.                                    |
| `selectedBadgeClassName`      | ClassName for the selected-count badge.                                 |
| `selectedBadgePlacement`      | Where to place the badge relative to the trigger content.               |

### Sample usage

```tsx
import { InputField } from "@timeax/form-palette"; // adjust import to your project

export function ListerExample() {
  return (
          <InputField
                  variant="lister"
                  name="user_id"
                  label="User"
                  description="Pick a user from a remote list."

                  // standalone inline source (no base `def` required)
                  endpoint="/api/admin/users"
                  method="GET"
                  selector="data" // or (res) => res.data
                  optionValue="id"
                  optionLabel={(u: any) => u.name}
                  optionDescription={(u: any) => u.email}

                  searchable
                  clearable
                  placeholder="Select a user..."
                  title="Select user"
          />
  );
}
```

## custom

### Variant props

| Prop              | Description                                                                                                                                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `component`       | React component to render. **Required.**                                                                                                                                                                     |
| `valueProp`       | Prop name that receives the current value. Default: `"value"`.                                                                                                                                               |
| `changeProp`      | Prop name for the change handler the component calls. Default: `"onChange"`. The component is expected to call `props[changeProp](nextValue, ...args)`; the **first** argument is treated as the next value. |
| `disabledProp`    | Prop name for disabled state. Default: `"disabled"`.                                                                                                                                                         |
| `readOnlyProp`    | Prop name for read-only state. Default: `"readOnly"`.                                                                                                                                                        |
| `errorProp`       | Optional prop name to pass the field `error` into the component (if it cares).                                                                                                                               |
| `idProp`          | Prop name for the `id` attribute. Default: `"id"`.                                                                                                                                                           |
| `nameProp`        | Prop name for the `name` attribute. Default: `"name"`.                                                                                                                                                       |
| `placeholderProp` | Prop name for the `placeholder` attribute. Default: `"placeholder"`.                                                                                                                                         |
| `mapValue`        | Optional transform for the raw next value before it hits the field: `(raw, ...args) => TValue`.                                                                                                              |
| `mapDetail`       | Optional builder for `ChangeDetail` given the raw next value: `(raw, ...args) => ChangeDetail`. If omitted, a default `{ source: "variant", raw }` detail is used.                                           |
| `...rest`         | Any other props are forwarded to your `component`.                                                                                                                                                           |

### Sample usage

```tsx
import * as React from "react";
import { InputField } from "@timeax/form-palette";

// Example custom component (Radix-like API)
function MyToggle(props: {
  checked?: boolean;
  onCheckedChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { checked, onCheckedChange, disabled } = props;

  return (
          <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={checked}
                  onClick={() => onCheckedChange?.(!checked)}
                  className="rounded border px-3 py-1"
          >
            {checked ? "On" : "Off"}
          </button>
  );
}

export function CustomExample() {
  return (
          <InputField
                  variant="custom"
                  name="marketing_opt_in"
                  label="Marketing emails"
                  description="Toggle to opt in."
                  component={MyToggle}
                  valueProp="checked"
                  changeProp="onCheckedChange"
          />
  );
}
```

---

# Form Palette â€” `extra` entrypoint (v2)

The `extra` entrypoint exposes two â€œpower toolsâ€ that sit beside the normal **Form / InputField** flow:

1. **Lister runtime** (provider + global UI + hooks) â€” a reusable, app-wide **picker** system for single/multi selection with search/filter + **remote / local / hybrid** data.
2. **JsonEditor** â€” an interactive JSON editor UI (also used by the `json-editor` InputField variant).

> This README is written against the `extra.ts` export surface:
>
> ```ts
> export * from "@/presets/lister/index";
> export { default as JsonEditor } from "@/presets/shadcn-variants/json-editor";
> ```

---

# 1) Lister (runtime)

## What is Lister?

Lister is a small runtime that lets you open a **picker UI** from anywhere in your app:

* **Single** selection (â€œchoose one userâ€) or **multi** selection (â€œchoose many tagsâ€).
* **Local**, **remote**, or **hybrid** search.
* A consistent session model: **open â†’ search/filter â†’ select â†’ apply/cancel**.
* App-level integration via a provider and a single UI renderer.

If you use the `lister` InputField variant, itâ€™s powered by this same runtime.

---

## Building blocks (what you actually mount/call)

### âœ… `ListerProvider`

* Holds the Lister store/context.
* Receives the **host** (permission checks + logging).
* Can register a **presets map** (reusable picker definitions).
* Supports provider-side remote debounce via `remoteDebounceMs` (default **300ms**).

### âœ… `ListerUI`

* Renders any **open sessions** (popovers) from the provider store.
* Mount this **once** under the provider.

### âœ… `useLister()`

* Imperative controller + access to store.

Provides:

* `api.open(...)` / `api.fetch(...)` (def/preset-based)
* session actions (apply/cancel/close)
* selection actions (toggle/select/deselect/clear)
* search actions (setQuery/searchLocal/searchRemote)
* filter helpers

### âœ… `useData()`

* Lower-level hook used for **fetching + searching + filters + selection state**.
* Exported so you can build custom list UIs that still behave like Lister.

---

## Quick start (recommended)

### Step 1 â€” Mount provider + UI once

```tsx
import * as React from "react";
import { ListerProvider, ListerUI } from "@timeax/form-palette/extra";

const host = {
  can: (permissions: string[], ctx: any) => true,
  log: (entry: any) => console.log("[lister]", entry),
};

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
          <ListerProvider host={host}>
            {children}
            <ListerUI />
          </ListerProvider>
  );
}
```

### Step 2 â€” Open a picker imperatively

```tsx
import * as React from "react";
import { useLister } from "@timeax/form-palette/extra";

export function PickUserButton() {
  const { api } = useLister<any>();

  return (
          <button
                  onClick={() => {
                    // "users" can be a preset key, or you can pass a definition inline
                    api.open("users", { status: "active" }, { title: "Select a user" });
                  }}
          >
            Pick user
          </button>
  );
}
```

---

## `ListerProvider` API

```ts
export function ListerProvider(props: {
  host: ListerProviderHost;
  presets?: PresetMap;
  http?: ListerHttpClient;
  remoteDebounceMs?: number; // default 300
  children: React.ReactNode;
})
```

### `ListerProviderHost`

```ts
export interface ListerProviderHost {
  /** Host decides permission logic. Mandatory permissions end with '!' */
  can: (permissions: string[], ctx: ListerPermissionCtx) => boolean;

  /** Host decides notification/diagnostic surface */
  log: (entry: ListerLogEntry) => void;
}
```

### Practical usage

* Use `can()` to gate actions like **open**, **refresh**, or **apply**.
* Use `log()` to send diagnostics to console, Sentry, or an in-app toast.

---

# 2) `useData()` â€” deep dive (extremely important)

`useData()` is the engine behind Lister-style **data fetching + searching + filtering + selection**.

Use it when:

* You want a **custom picker UI** (your own layout, rows, pagination).
* You want a **data-backed selection** UX but not the standard Lister popover.
* You want Listerâ€™s semantics (remote/local/hybrid search + filters) in other UIs.

> It works only under `<ListerProvider />` because it uses the providerâ€™s fetch engine.

---

## What `useData()` returns (mental model)

`useData()` returns two lists:

* `data`: the raw fetched list from the provider.
* `visible`: what your UI should render.

    * In **remote** mode: `visible === data`.
    * In **local / hybrid**: `visible` is client-filtered using `query + searchTarget`.

It also returns **selection state** (optional) and **fetch/search/filter helpers**.

---

## `UseDataOptions` (inputs)

| Option                     | Description                                                                  |
|----------------------------|------------------------------------------------------------------------------|
| `id?`                      | Optional identifier used when building the inline def.                       |
| `endpoint`                 | URL/path to fetch items from.                                                |
| `method?`                  | HTTP method (default: `"GET"`).                                              |
| `selector?`                | How to extract the list from your response (string path or mapper function). |
| `buildRequest?`            | Build `{ params?, body?, headers? }` from `{ filters, query, cursor }`.      |
| `search?`                  | `{ default?: string }` sets a default `searchTarget` subject key.            |
| `filters?`                 | Initial filters object.                                                      |
| `initial?`                 | Initial items to avoid immediate fetch.                                      |
| `enabled?`                 | Disable all fetching/effects when false (default: `true`).                   |
| `fetchOnMount?`            | Auto-fetch on mount (default: `!initial`).                                   |
| `searchMode?`              | `"remote"` (default) or `"local"` or `"hybrid"`.                             |
| `debounceMs?`              | Debounce for query/target changes in remote/hybrid (default: **300ms**).     |
| `autoFetchOnFilterChange?` | In remote/hybrid: auto-fetch when filters change (default: `true`).          |
| `selection?`               | Enable selection helpers: `{ mode, key?, prune? }`.                          |

### Selection config (`selection`)

| Key     | Meaning                                                                                                                  |
|---------|--------------------------------------------------------------------------------------------------------------------------|
| `mode`  | `"single"` or `"multiple"` (omit = no selection).                                                                        |
| `key`   | How to compute the item ID. String key (e.g. `"id"`) or `(item) => id`.                                                  |
| `prune` | `"never"` (default) keeps selection across new fetches. `"missing"` removes selected IDs not present in the latest list. |

**Defaults**

* Default `key` behavior is effectively: `item.id ?? item.value`.

---

## Search modes: remote vs local vs hybrid

### âœ… `remote` (default)

* Query changes trigger a **debounced fetch**.
* The server is responsible for searching.

Best for: **large datasets**, server ranking, true search endpoints.

### âœ… `local`

* Switching to local fetches a **base list once** using an empty query.
* After that, `visible` is filtered client-side.

Best for: **small-medium datasets** you can cache (countries, categories, roles).

### âœ… `hybrid`

* Query changes still fetch remotely.
* But `visible` also applies the local filtering rules.

Best for: â€œserver list + extra client constraintsâ€ (e.g. `searchOnly`).

---

## Search targeting (`searchTarget`)

`useData()` supports Lister-style targeting via `searchTarget`:

* `mode: "all"` â†’ search across everything
* `mode: "subject"` â†’ search only against one subject field (e.g. `name`)
* `mode: "only"` â†’ constrain results to a known list of IDs

If you pass `search={{ default: "name" }}`, the default target becomes `mode:"subject"` on that key.

---

## Core returned API (what youâ€™ll use most)

### Data + status

* `data`, `visible`
* `loading`, `error`

### Search

* `query`, `setQuery(query)`
* `searchMode`, `setSearchMode(mode)`
* `searchTarget`, `setSearchTarget(target)`

### Filters

* `filters`, `setFilters(next)`
* `patchFilters(partial)`
* `clearFilters()`

### Fetch

* `refresh()` â€” refetch using current query/filters/target
* `fetch({ query?, filters?, searchTarget?, search? })` â€” manual override fetch

### Selection (when enabled)

* `selectionMode` (`none | single | multiple`)
* `selectedIds` (array)
* `selected` (array of objects resolved from cache)
* `select(id)`, `deselect(id)`, `toggle(id)`, `clearSelection()`
* `isSelected(id)`
* `getSelection()` â€” returns the best current selection shape

> Important: selection maintains an internal cache so selected objects can be returned even when the current page/list no longer contains them.

---

## `useData()` â€” practical use cases (full examples)

### Use case A â€” Remote search list (simple)

```tsx
import * as React from "react";
import { useData } from "@timeax/form-palette/extra";

type User = { id: string; name: string; email: string };

export function RemoteUserSearch() {
    const { visible, loading, error, query, setQuery, refresh } = useData<User>({
        endpoint: "/api/users",
        method: "GET",
        selector: "data", // or (res) => res.data
        search: { default: "name" },
    });

    return (
        <div>
            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search usersâ€¦"
            />
            <button onClick={refresh} disabled={loading}>
                Refresh
            </button>

            {loading && <p>Loadingâ€¦</p>}
            {error && <p style={{ color: "crimson" }}>{String(error)}</p>}

            <ul>
                {visible.map((u) => (
                    <li key={u.id}>
                        <b>{u.name}</b> <small>{u.email}</small>
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

---

### Use case B â€” Local mode (fetch once, instant client filtering)

```tsx
import * as React from "react";
import { useData } from "@timeax/form-palette/extra";

type Country = { code: string; name: string };

export function CountryPickerLocal() {
    const { visible, query, setQuery } = useData<Country>({
        endpoint: "/api/countries",
        method: "GET",
        selector: "data",
        search: { default: "name" },
        searchMode: "local",
    });

    return (
        <div>
            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countriesâ€¦"
            />
            <ul>
                {visible.map((c) => (
                    <li key={c.code}>{c.name}</li>
                ))}
            </ul>
        </div>
    );
}
```

---

### Use case C â€” Filters with `patchFilters` (remote/hybrid auto-fetch)

```tsx
import * as React from "react";
import { useData } from "@timeax/form-palette/extra";

type Filters = { status?: string; role?: string };

export function FilteredUsers() {
    const { visible, filters, patchFilters, clearFilters, loading } = useData<any, Filters>({
        endpoint: "/api/users",
        method: "GET",
        selector: "data",
        filters: { status: "active" },
        autoFetchOnFilterChange: true,
    });

    return (
        <div>
            <div style={{ display: "flex", gap: 8 }}>
                <select
                    value={filters?.status ?? ""}
                    onChange={(e) => patchFilters({ status: e.target.value || undefined })}
                >
                    <option value="">Any status</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                </select>

                <select
                    value={filters?.role ?? ""}
                    onChange={(e) => patchFilters({ role: e.target.value || undefined })}
                >
                    <option value="">Any role</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                </select>

                <button onClick={clearFilters} disabled={loading}>
                    Clear
                </button>
            </div>

            <ul>
                {visible.map((u: any) => (
                    <li key={u.id}>{u.name}</li>
                ))}
            </ul>
        </div>
    );
}
```

---

### Use case D â€” Constrain to a known allow-list (`searchTarget: mode="only"`)

```tsx
import * as React from "react";
import { useData } from "@timeax/form-palette/extra";

export function AllowedIdsOnly() {
    const allowed = React.useMemo(() => ["u_1", "u_8", "u_12"], []);

    const { visible, setSearchTarget, searchMode, setSearchMode } = useData<any>({
        endpoint: "/api/users",
        method: "GET",
        selector: "data",
        searchMode: "local",
    });

    React.useEffect(() => {
        setSearchTarget({ mode: "only", only: allowed, subject: null });
    }, [allowed, setSearchTarget]);

    return (
        <div>
            <small>mode: {searchMode}</small>
            <button onClick={() => setSearchMode("local")}>Local</button>
            <button onClick={() => setSearchMode("remote")}>Remote</button>

            <ul>
                {visible.map((u: any) => (
                    <li key={u.id}>{u.name}</li>
                ))}
            </ul>
        </div>
    );
}
```

---

### Use case E â€” Custom multi-select UI (selection enabled)

```tsx
import * as React from "react";
import { useData } from "@timeax/form-palette/extra";

type Tag = { id: string; name: string };

export function TagMultiSelect() {
    const { visible, isSelected, toggle, selectedIds, selected } = useData<Tag>({
        endpoint: "/api/tags",
        method: "GET",
        selector: "data",
        searchMode: "remote",
        selection: {
            mode: "multiple",
            key: "id",
            prune: "never", // keep selection stable while remote results change
        },
    });

    return (
        <div>
            <ul>
                {visible.map((t) => (
                    <li key={t.id}>
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                                type="checkbox"
                                checked={isSelected(t.id)}
                                onChange={() => toggle(t.id)}
                            />
                            {t.name}
                        </label>
                    </li>
                ))}
            </ul>

            <pre style={{ marginTop: 12 }}>
selectedIds: {JSON.stringify(selectedIds, null, 2)}

                selected objects: {JSON.stringify(selected, null, 2)}
      </pre>
        </div>
    );
}
```

---

### Use case F â€” Advanced request shaping (`buildRequest`)

```tsx
import { useData } from "@timeax/form-palette/extra";

export function CustomPayloadExample() {
    const { visible } = useData<any, { status?: string }>({
        endpoint: "/api/users/search",
        method: "POST",
        selector: "items",

        buildRequest: ({ query, filters, cursor }) => ({
            body: {
                q: query,
                filters,
                cursor,
            },
            headers: {
                "X-Search-Mode": "users",
            },
        }),
    });

    return <pre>{JSON.stringify(visible, null, 2)}</pre>;
}
```

---

## Practical tips

* Want instant search UX and your dataset is small â†’ `searchMode: "local"`.
* Want selection to persist while users search remotely â†’ `selection.prune = "never"`.
* Want selection to strictly match whatâ€™s visible in the current list â†’ `selection.prune = "missing"`.
* Want lazy fetch (open a modal first) â†’ `enabled: false`, then call `fetch()` when needed.

---

# 3) JsonEditor (overview)

JsonEditor is exported from `extra` as:

```ts
import { JsonEditor } from "@timeax/form-palette/extra";
```

Use it when you want a structured JSON editing experience (often used behind the `json-editor` InputField variant).

## Standalone usage

```tsx
import * as React from "react";
import { JsonEditor } from "@timeax/form-palette/extra";

export function JsonEditorStandalone() {
    const [root, setRoot] = React.useState({
        user: { name: "Ada", roles: ["admin"] },
    });

    return (
        <JsonEditor
            root={root}
            onRoot={setRoot}
            open
            onClose={() => console.log("closed")}
            title="User JSON"
        />
    );
}
```


