import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { Footer } from "../components/footer";

export default function VerifyEmail({
  email,
  code 
}: {
  email: string;
  code: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your Acme Verification Code</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 max-w-[600px] rounded border border-solid border-neutral-200 px-10 py-5">
            <Heading className="mx-0 my-7 p-0 text-xl font-medium text-black">
              Please confirm your email address
            </Heading>
            <Text className="mx-auto text-sm leading-6">
              Enter this code on the Acme verify page to complete your sign up:
            </Text>
            <Section className="my-8 rounded-lg border border-solid border-neutral-200">
              <div className="mx-auto w-fit px-6 py-3 text-center font-mono text-2xl font-semibold tracking-[0.25em]">
                {code}
              </div>
            </Section>
            <Text className="text-sm leading-6 text-black">
              This code expires in 10 minutes.
            </Text>
            <Footer email={email} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}