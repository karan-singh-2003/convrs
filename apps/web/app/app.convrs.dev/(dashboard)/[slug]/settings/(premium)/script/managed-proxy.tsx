import Form from "@/ui/shared/form";

export default function ManagedProxy() {
    return (
        <Form
            title="Managed Proxy"
            description={`Route your tracking script through convrs.dev to bypass ad blockers.`}
            inputAtts={{
                name: "proxy sub-domain",
                placeholder: "a.convrs.dev",
            }}
            buttonText="Enable Managed Proxy"
            disabledTooltip={undefined}
            handleSubmit={async (data) => {
                console.log("data", data)
            }}
        ></Form>
    );
}