// Fails when en.json has a key the app never uses: every key is work for each translator.
//
// A key counts as used when the code names it in quotes ("plants.title"), or builds it in a
// template string (`directions.${direction}`, `places.bed${type}`, `glance.${kind}.today`):
// then every key the template could make counts, each `${...}` standing for a word.
// Plural forms (_one, _other, ...) count with their key.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const english = JSON.parse(readFileSync(join(root, "src/i18n/locales/en.json"), "utf8"));

function keys(tree, prefix = "") {
    return Object.entries(tree).flatMap(([name, value]) =>
        typeof value === "object" ? keys(value, `${prefix}${name}.`) : [`${prefix}${name}`],
    );
}

function sources(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "locales" ? [] : sources(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
}

const code = sources(join(root, "src"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
// Templates that look like keys: words and dots, with at least one `${...}`.
const templates = [...code.matchAll(/`((?:[A-Za-z0-9_.]|\$\{[^}`]*\})+)`/g)]
    .map((match) => match[1])
    .filter((template) => template.includes("${") && /^[A-Za-z]/.test(template))
    .map((template) => {
        const pattern = template
            .split(/\$\{[^}]*\}/)
            .map((part) => part.replace(/\./g, "\\."))
            .join("[A-Za-z0-9_]*");
        return new RegExp(`^${pattern}$`);
    });
const plural = /_(zero|one|two|few|many|other)$/;

const unused = keys(english).filter((key) => {
    const base = key.replace(plural, "");
    if (code.includes(`"${base}"`) || code.includes(`'${base}'`) || code.includes(`\`${base}\``)) {
        return false;
    }
    return !templates.some((template) => template.test(base));
});

if (unused.length > 0) {
    console.error(
        `Translation keys nothing uses (remove them from en.json):\n  ${unused.join("\n  ")}`,
    );
    process.exit(1);
}
console.log(`All ${keys(english).length} translation keys are used.`);
