var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();
app.UseCors();

app.MapGet("/api/message", (IConfiguration config) =>
{
    var text = config["Message"] ?? "Hello from the API";
    return Results.Ok(new { message = text });
});

app.Run();
