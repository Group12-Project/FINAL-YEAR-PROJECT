# Registration save fix

- Full name, Roll / ID, and Class / Section are now all required before registration.
- Save handler validates the live form values and focuses the missing/invalid field.
- Face embeddings are copied into a serializable array before persistence.
- The app reads the saved record back from local storage and verifies name, roll, and class before showing success or clearing the form.
- The recent registrations table continues to show Name, Roll, and Class.
- If browser storage is blocked/full, the form is not cleared and the user receives an error.

Note: browser-local registrations are stored in the same browser profile/device. Server face-template sync remains separately consent-based and requires an authorized signed-in Teacher/Admin account.
