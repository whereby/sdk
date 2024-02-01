# dotenv-run-script

Run NPM scripts with changing environments.

## Usage

Install the package

```bash
npm install dotenv-run-script --save-dev
```

Add one or more scripts to your `package.json` which uses one or more environment variables (`GREETINGS` in the example below)

```js
{
  // ... other package stuff above
  "scripts": {
    "test": "echo $GREETING world!"
  }
}
```

Create an `.env` file with the variables used by the script

```
GREETING=Hello
```

```bash
npx dotenv-run-script test
```

Run the `test` NPM script.

## Using multiple `.env` files

The `dotenv-run-script` CLI takes any number of optional positional arguments, one for each `.env` file to be loaded (in sequence). 

The arguments are checked in sequence, all arguments will get [parsed](https://www.npmjs.com/package/dotenv#parse) and [expanded](https://www.npmjs.com/package/dotenv-expand) until either the argument `--` or the argument does not resolve to a file.

The following loads a `.env` followed by a `.env.production` file and proceeds to execute the `test` script.

```bash
npx dotenv-run-script .env .env.production -- test
```

## Adding a script per environment

It's recommended to add a script to the project's package.json to signal the use of `dotenv-run-script` and ease the discovery of supported environments:

```js
{
  // ... other package stuff above
  "scripts": {
    "greet": "echo $GREETING $PLACE",
    "production": "dotenv-run-script .env .env.production --",
    "development": "dotenv-run-script .env .env.development --",
  }
}
```

```
// .env
GREETING=Hello
PLACE=World!
```

```
// .env.production
PLACE=Universe!
```

```
// .env.development
PLACE=Localhost
```

In the example above, two environments are used `.env.production` and `.env.development` in addition to a shared `.env` which includes common variables. Notice how the `PLACE` variable gets overridden.

The `greet` script can be invoked with

```bash
npm run production greet
```

## Examples

See the [simple](examples/simple) and [advanced](examples/advanced) examples for usage.

## Alternatives you might consider using

- [dotenv's preload script](https://www.npmjs.com/package/dotenv#preload)
- [dotenv-run](https://www.npmjs.com/package/dotenv-run) which provide similar, but limited functionality to this package. At the time of writing this, it does not
  - use dotenv-expand to assign variables from other variables.
  - allow multiple .env files to be loaded in sequence
  - call `npm run` but any executable
